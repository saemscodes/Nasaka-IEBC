// src/services/travelService.ts
// Travel Intelligence Service — OpenRouteService + Visual Crossing + Open-Meteo + AI Consensus
// Provides "Travel Difficulty Score" for IEBC office visits

import { getAIDifficultyScore, type AIScoreResult, type AIConsensusInput } from './aiService';
import { toDecimalDegrees } from '@/utils/geoUtils';

const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY || 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjA0ZTcwZDQyMTMwNjRmYzNiMmNjMzQyMTI2MTIxYTdmIiwiaCI6Im11cm11cjY0In0=';
const VC_API_KEY = import.meta.env.VITE_VC_API_KEY || 'R8QQ25ARUVVFEZHJY3BX3DRGJ';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TravelInsights {
    score: number;
    distanceKm: number;
    timeMins: number;
    weatherDesc: string;
    weatherIcon: string;
    temperature: number | null;
    humidity: number | null;
    windSpeed: number | null;
    precipProb: number | null;
    severity: 'low' | 'medium' | 'high';
    routeGeometry: any | null;
    stale: boolean;
    fetchedAt: number;
    // AI Intelligence Layer (Nasaka Consensus)
    aiScore: number | null;
    aiReason: string | null;
    aiProvider: string | null;
    aiConfidence: 'high' | 'medium' | 'low' | null;
    aiGroundTruthVerified: boolean;
    aiGroundTruthNote: string | null;
}

export interface WeatherData {
    conditions: string;
    icon: string;
    temp: number | null;
    humidity: number | null;
    windspeed: number | null;
    precipprob: number | null;
    visibility: number | null;
    cloudcover: number | null;
}

// ─── In-Memory Cache ────────────────────────────────────────────────────────

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
        cache.delete(key);
        return null;
    }
    return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
    cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
}

// ─── Coordinate Bucketing (reduce cache key cardinality) ────────────────────

function bucketCoord(val: number, precision = 3): string {
    return val.toFixed(precision);
}

function routeCacheKey(lat1: number, lon1: number, lat2: number, lon2: number): string {
    return `route:${bucketCoord(lat1)},${bucketCoord(lon1)}:${bucketCoord(lat2)},${bucketCoord(lon2)}`;
}

function weatherCacheKey(lat: number, lon: number): string {
    return `weather:${bucketCoord(lat, 2)},${bucketCoord(lon, 2)}`;
}

// ─── API Quota Guard ────────────────────────────────────────────────────────

const quotaCounters: Record<string, { count: number; resetAt: number }> = {};

function checkQuota(provider: string, dailyLimit: number): boolean {
    const now = Date.now();
    if (!quotaCounters[provider] || now > quotaCounters[provider].resetAt) {
        quotaCounters[provider] = { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
    }
    return quotaCounters[provider].count < dailyLimit * 0.8; // 80% threshold
}

function incrementQuota(provider: string): void {
    if (quotaCounters[provider]) {
        quotaCounters[provider].count++;
    }
}

// ─── OpenRouteService Directions ────────────────────────────────────────────

interface ORSRouteResult {
    distanceMeters: number;
    durationSeconds: number;
    geometry: any;
}

async function fetchORSRoute(
    originLat: number, originLon: number,
    destLat: number, destLon: number
): Promise<ORSRouteResult | null> {
    // Validate coordinate ranges before calling ORS
    if (originLat < -90 || originLat > 90 || destLat < -90 || destLat > 90 ||
        originLon < -180 || originLon > 180 || destLon < -180 || destLon > 180) {
        console.warn('[TravelService] Invalid coordinates, skipping ORS call:', {
            origin: [originLat, originLon], dest: [destLat, destLon]
        });
        return null;
    }

    const cacheKey = routeCacheKey(originLat, originLon, destLat, destLon);
    const cached = getCached<ORSRouteResult>(cacheKey);
    if (cached) return cached;

    if (!checkQuota('ors', 2000)) {
        console.warn('[TravelService] ORS quota approaching limit, using cached/fallback');
        return null;
    }

    try {
        const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${originLon},${originLat}&end=${destLon},${destLat}`;
        const res = await fetch(url);
        incrementQuota('ors');

        if (!res.ok) {
            console.warn(`[TravelService] ORS error: ${res.status}`);
            return null;
        }

        const data = await res.json();
        const feature = data.features?.[0];
        if (!feature) return null;

        const result: ORSRouteResult = {
            distanceMeters: feature.properties.summary.distance,
            durationSeconds: feature.properties.summary.duration,
            geometry: feature.geometry
        };

        // Cache routing (static geometry) for 24 hours
        setCache(cacheKey, result, 24 * 60 * 60 * 1000);
        return result;
    } catch (err) {
        console.error('[TravelService] ORS fetch failed:', err);
        return null;
    }
}

// ─── Visual Crossing Weather ────────────────────────────────────────────────

async function fetchVCWeather(lat: number, lon: number): Promise<WeatherData | null> {
    const cacheKey = weatherCacheKey(lat, lon);
    const cached = getCached<WeatherData>(cacheKey);
    if (cached) return cached;

    if (!checkQuota('visualcrossing', 1000)) {
        console.warn('[TravelService] VC quota approaching limit');
        return null;
    }

    try {
        const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lon}/today?key=${VC_API_KEY}&include=current&unitGroup=metric`;
        const res = await fetch(url);
        incrementQuota('visualcrossing');

        if (!res.ok) {
            console.error(`[TravelService] VC error: ${res.status}`);
            return null;
        }

        const data = await res.json();
        const current = data.currentConditions;
        if (!current) return null;

        const weather: WeatherData = {
            conditions: current.conditions || 'Unknown',
            icon: current.icon || 'clear-day',
            temp: current.temp ?? null,
            humidity: current.humidity ?? null,
            windspeed: current.windspeed ?? null,
            precipprob: current.precipprob ?? null,
            visibility: current.visibility ?? null,
            cloudcover: current.cloudcover ?? null
        };

        // Cache weather for 15 minutes
        setCache(cacheKey, weather, 15 * 60 * 1000);
        return weather;
    } catch (err) {
        console.error('[TravelService] VC fetch failed:', err);
        return null;
    }
}

// ─── Open-Meteo Fallback (no API key) ───────────────────────────────────────

async function fetchOpenMeteoWeather(lat: number, lon: number): Promise<WeatherData | null> {
    const cacheKey = `openmeteo:${bucketCoord(lat, 2)},${bucketCoord(lon, 2)}`;
    const cached = getCached<WeatherData>(cacheKey);
    if (cached) return cached;

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,cloud_cover`;
        const res = await fetch(url);

        if (!res.ok) return null;

        const data = await res.json();
        const current = data.current;
        if (!current) return null;

        const weatherCode = current.weather_code || 0;
        const conditions = wmoCodeToCondition(weatherCode);

        const weather: WeatherData = {
            conditions,
            icon: wmoCodeToIcon(weatherCode),
            temp: current.temperature_2m ?? null,
            humidity: current.relative_humidity_2m ?? null,
            windspeed: current.wind_speed_10m ?? null,
            precipprob: current.precipitation > 0 ? 80 : 0,
            visibility: null,
            cloudcover: current.cloud_cover ?? null
        };

        setCache(cacheKey, weather, 15 * 60 * 1000);
        return weather;
    } catch {
        return null;
    }
}

// ─── WMO Weather Code Helpers ───────────────────────────────────────────────

function wmoCodeToCondition(code: number): string {
    if (code === 0) return 'Clear sky';
    if (code <= 3) return 'Partly cloudy';
    if (code <= 48) return 'Foggy';
    if (code <= 57) return 'Drizzle';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 82) return 'Rain showers';
    if (code <= 86) return 'Snow showers';
    if (code >= 95) return 'Thunderstorm';
    return 'Unknown';
}

function wmoCodeToIcon(code: number): string {
    if (code === 0) return 'clear-day';
    if (code <= 3) return 'partly-cloudy-day';
    if (code <= 48) return 'fog';
    if (code <= 67) return 'rain';
    if (code <= 77) return 'snow';
    if (code <= 86) return 'snow';
    if (code >= 95) return 'thunder-rain';
    return 'cloudy';
}

// ─── Weather Penalty Calculation ────────────────────────────────────────────

function calculateWeatherPenalty(weather: WeatherData): number {
    let penalty = 0;

    // Precipitation probability
    const precip = weather.precipprob || 0;
    if (precip > 80) penalty += 0.9;
    else if (precip > 50) penalty += 0.4;
    else if (precip > 20) penalty += 0.1;

    // Wind speed (km/h)
    const wind = weather.windspeed || 0;
    if (wind > 50) penalty += 0.8;
    else if (wind > 30) penalty += 0.3;
    else if (wind > 15) penalty += 0.1;

    // Low visibility
    const vis = weather.visibility;
    if (vis !== null && vis < 2) penalty += 0.5;
    else if (vis !== null && vis < 5) penalty += 0.2;

    return Math.min(penalty, 1); // Clamp to 0-1
}

// ─── Haversine Distance (fallback when ORS unavailable) ─────────────────────

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Main Entry Point: getTravelInsights ────────────────────────────────────

// Configurable weights (stored here; could be moved to config)
const WEIGHTS = {
    distance: 0.2,
    time: 0.4,
    traffic: 0.3, // Implicit in ORS routing time vs haversine time
    weather: 0.1
};

const MAX_DISTANCE_KM = 100;
const MAX_TIME_MINS = 120;

export async function getTravelInsights(
    origin: [number, number],
    dest: [number, number],
    officeContext?: { name?: string; county?: string; verified?: boolean }
): Promise<TravelInsights> {
    // Defense-in-depth: Ensure coordinates are in decimal degrees
    const lat1 = toDecimalDegrees(origin[0], true);
    const lon1 = toDecimalDegrees(origin[1], false);
    const lat2 = toDecimalDegrees(dest[0], true);
    const lon2 = toDecimalDegrees(dest[1], false);

    // Parallel fetch: route + weather (with fallback chain)
    const [route, weather] = await Promise.all([
        fetchORSRoute(lat1, lon1, lat2, lon2),
        fetchVCWeather(lat2, lon2).then(w => w || fetchOpenMeteoWeather(lat2, lon2))
    ]);

    // Extract or fallback values
    const distanceKm = route
        ? route.distanceMeters / 1000
        : haversineDistance(lat1, lon1, lat2, lon2);

    const timeMins = route
        ? route.durationSeconds / 60
        : (distanceKm / 40) * 60; // Estimate 40 km/h average

    const weatherData: WeatherData = weather || {
        conditions: 'Unknown',
        icon: 'cloudy',
        temp: null,
        humidity: null,
        windspeed: null,
        precipprob: null,
        visibility: null,
        cloudcover: null
    };

    // Calculate normalized score components (0-1)
    const distanceScore = Math.min(distanceKm / MAX_DISTANCE_KM, 1);
    const timeScore = Math.min(timeMins / MAX_TIME_MINS, 1);
    const weatherPenalty = calculateWeatherPenalty(weatherData);

    // Traffic score: compare ORS time against haversine estimate
    const haversineEstimate = (haversineDistance(lat1, lon1, lat2, lon2) / 40) * 60;
    const trafficScore = route
        ? Math.min(Math.max((timeMins - haversineEstimate) / haversineEstimate, 0), 1)
        : 0;

    // Weighted final score (0-100 scale, lower is easier)
    const rawScore =
        WEIGHTS.distance * distanceScore +
        WEIGHTS.time * timeScore +
        WEIGHTS.traffic * trafficScore +
        WEIGHTS.weather * weatherPenalty;

    const score = Math.round(rawScore * 100);

    // AI Intelligence Layer — non-blocking enhancement
    let aiResult: AIScoreResult | null = null;
    try {
        const aiInput: AIConsensusInput = {
            officeName: officeContext?.name || 'IEBC Office',
            county: officeContext?.county || 'Kenya',
            latitude: lat2,
            longitude: lon2,
            weatherDesc: weatherData.conditions,
            temperature: weatherData.temp,
            humidity: weatherData.humidity,
            windSpeed: weatherData.windspeed,
            precipProb: weatherData.precipprob,
            distanceKm: parseFloat(distanceKm.toFixed(1)),
            timeMins: Math.round(timeMins),
            isVerified: officeContext?.verified ?? true,
            currentScore: score,
            isFallbackDistance: !route // True if we used Haversine fallback
        };
        aiResult = await getAIDifficultyScore(aiInput);
    } catch {
        // AI is non-blocking — never prevents core insights from returning
    }

    return {
        score,
        distanceKm: parseFloat(distanceKm.toFixed(1)),
        timeMins: Math.round(timeMins),
        weatherDesc: weatherData.conditions,
        weatherIcon: weatherData.icon,
        temperature: weatherData.temp,
        humidity: weatherData.humidity,
        windSpeed: weatherData.windspeed,
        precipProb: weatherData.precipprob,
        severity: score > 70 ? 'high' : score > 40 ? 'medium' : 'low',
        routeGeometry: route?.geometry || null,
        stale: !route || !weather,
        fetchedAt: Date.now(),
        aiScore: aiResult?.score ?? null,
        aiReason: aiResult?.reason ?? null,
        aiProvider: aiResult?.provider ?? null,
        aiConfidence: aiResult?.confidence ?? null,
        aiGroundTruthVerified: aiResult?.groundTruthVerified ?? false,
        aiGroundTruthNote: aiResult?.groundTruthNote ?? null
    };
}

// ─── Batch: Score Multiple Offices ──────────────────────────────────────────

export async function scoreMultipleOffices(
    userLat: number,
    userLon: number,
    offices: Array<{ id: string; latitude: number; longitude: number }>
): Promise<Array<{ id: string; insights: TravelInsights }>> {
    // Sequential to respect rate limits (6 concurrent max)
    const results: Array<{ id: string; insights: TravelInsights }> = [];
    const batchSize = 3;

    for (let i = 0; i < offices.length; i += batchSize) {
        const batch = offices.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(async (office) => ({
                id: office.id,
                insights: await getTravelInsights(
                    [userLat, userLon],
                    [office.latitude, office.longitude]
                )
            }))
        );
        results.push(...batchResults);
    }

    // Sort by score (lower is better)
    return results.sort((a, b) => a.insights.score - b.insights.score);
}
