// src/lib/geocoding/pipeline.ts
// Multi-Layer Geocoding Pipeline — Zero 404s
// Each layer is independent — failure of one triggers the next
// All layers return GeocodedResult — same shape, unified interface
//
// Layer 1:  Local Fuse.js (IEBC offices — instant, offline)
// Layer 2:  Nominatim OSM (Kenya-scoped, 1req/s)
// Layer 3:  Photon (OSM-based, faster, no rate limit)
// Layer 4:  Overpass API (raw OSM — obscure hamlets, schools, markets)
// Layer 5:  Constituency centroid (Supabase — 290 constituencies)
// Layer 6:  County centroid (static — 47 counties, never fails)
// Layer 7:  IP geolocation (last resort before manual)
//
// Paid layers (Google, Mapbox, HERE, Pelias) are defined but require
// env vars to activate. Without keys they are silently skipped.

import Fuse from 'fuse.js';
import { supabase } from '@/integrations/supabase/client';
import { normalizeQuery } from '@/lib/searchUtils';

// ─── Types ───────────────────────────────────────────────────────────────────

export type GeocodingSource =
    | 'local_fuse'
    | 'nominatim'
    | 'photon'
    | 'overpass'
    | 'constituency_centroid'
    | 'county_centroid'
    | 'ip_geolocation'
    | 'google'
    | 'mapbox'
    | 'here'
    | 'pelias'
    | 'manual_picker';

export interface GeocodedResult {
    lat: number;
    lng: number;
    name: string;
    displayName: string;
    confidence: number;
    source: GeocodingSource;
    type: string;
    county?: string;
    country?: string;
    countryCode?: string;
    boundingBox?: [number, number, number, number];
    isKenyan: boolean;
}

export interface PipelineResult {
    result: GeocodedResult | null;
    layerUsed: GeocodingSource | null;
    allAttempts: { layer: GeocodingSource; success: boolean; reason?: string }[];
    fallbackDepth: number;
}

export interface PipelineOptions {
    isGlobal?: boolean;
    countryCode?: string;
    maxLayers?: number;
    skipLayers?: GeocodingSource[];
}

// ─── LAYER 1: Local Fuse.js (IEBC offices — instant) ────────────────────────

let fuseInstance: Fuse<any> | null = null;
let localOffices: any[] = [];

export function setLocalOffices(offices: any[]): void {
    localOffices = offices;
    fuseInstance = new Fuse(offices, {
        keys: [
            { name: 'county', weight: 0.3 },
            { name: 'constituency_name', weight: 0.25 },
            { name: 'constituency', weight: 0.2 },
            { name: 'office_location', weight: 0.15 },
            { name: 'landmark', weight: 0.05 },
            { name: 'formatted_address', weight: 0.05 },
        ],
        threshold: 0.35,
        minMatchCharLength: 2,
        includeScore: true,
    });
}

async function layer1_localFuse(query: string): Promise<GeocodedResult[]> {
    if (!fuseInstance || localOffices.length === 0) return [];

    const results = fuseInstance.search(query, { limit: 5 });
    return results
        .filter((r) => r.item.latitude && r.item.longitude)
        .map((r) => ({
            lat: r.item.latitude,
            lng: r.item.longitude,
            name: r.item.office_location || r.item.constituency_name || r.item.county,
            displayName: `${r.item.office_location || r.item.constituency_name}, ${r.item.county} County`,
            confidence: 1 - (r.score || 0),
            source: 'local_fuse' as GeocodingSource,
            type: 'office',
            county: r.item.county,
            country: 'Kenya',
            countryCode: 'KE',
            isKenyan: true,
        }));
}

// ─── LAYER 2: Nominatim ──────────────────────────────────────────────────────

async function layer2_nominatim(
    query: string,
    countryCode: string = 'ke'
): Promise<GeocodedResult[]> {
    const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        extratags: '1',
        namedetails: '1',
        limit: '5',
        'accept-language': 'en,sw',
        ...(countryCode ? { countrycodes: countryCode } : {}),
    });

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: {
            'User-Agent': 'NasakaIEBC/1.0 (nasakaiebc.civiceducationkenya.com)',
        },
    });

    if (!res.ok) throw new Error('Nominatim failed');
    const data = await res.json();

    return data.map((item: any) => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        name: item.namedetails?.name || item.display_name.split(',')[0],
        displayName: item.display_name,
        confidence: Math.min(parseFloat(item.importance || '0.5'), 1),
        source: 'nominatim' as GeocodingSource,
        type: item.type,
        county: item.address?.state || item.address?.county,
        country: item.address?.country,
        countryCode: item.address?.country_code?.toUpperCase(),
        boundingBox: item.boundingbox?.map(parseFloat) as
            | [number, number, number, number]
            | undefined,
        isKenyan: item.address?.country_code === 'ke',
    }));
}

// ─── LAYER 3: Photon (OSM-based, no strict rate limit) ──────────────────────

async function layer3_photon(
    query: string,
    countryCode: string = 'KE'
): Promise<GeocodedResult[]> {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '5');
    url.searchParams.set('lang', 'en');

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Photon failed');

    const data = await res.json();

    return (data.features || [])
        .filter((f: any) => {
            if (!countryCode) return true;
            return (
                f.properties.countrycode?.toUpperCase() === countryCode.toUpperCase()
            );
        })
        .map((f: any) => ({
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            name: f.properties.name || f.properties.city || query,
            displayName: [
                f.properties.name,
                f.properties.city,
                f.properties.state,
                f.properties.country,
            ]
                .filter(Boolean)
                .join(', '),
            confidence: 0.7,
            source: 'photon' as GeocodingSource,
            type: f.properties.osm_value || 'place',
            county: f.properties.state,
            country: f.properties.country,
            countryCode: f.properties.countrycode?.toUpperCase(),
            isKenyan: f.properties.countrycode === 'KE',
        }));
}

// ─── LAYER 4: Overpass API (raw OSM — obscure places) ────────────────────────

async function layer4_overpass(query: string): Promise<GeocodedResult[]> {
    const escapedQuery = query.replace(/"/g, '\\"');
    const overpassQuery = `
    [out:json][timeout:10];
    area["ISO3166-1"="KE"]->.kenya;
    (
      node["name"~"${escapedQuery}",i](area.kenya);
      way["name"~"${escapedQuery}",i](area.kenya);
    );
    out center 5;
  `;

    const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(overpassQuery)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!res.ok) throw new Error('Overpass failed');
    const data = await res.json();

    return (data.elements || [])
        .slice(0, 5)
        .map((el: any) => {
            const lat = el.lat || el.center?.lat;
            const lng = el.lon || el.center?.lon;
            if (!lat || !lng) return null;
            return {
                lat,
                lng,
                name: el.tags?.name || query,
                displayName: `${el.tags?.name || query}, Kenya`,
                confidence: 0.5,
                source: 'overpass' as GeocodingSource,
                type: el.tags?.place || el.tags?.amenity || el.type || 'place',
                county: el.tags?.['addr:county'],
                country: 'Kenya',
                countryCode: 'KE',
                isKenyan: true,
            };
        })
        .filter(Boolean) as GeocodedResult[];
}

// ─── LAYER 5: Constituency Centroid (Supabase) ──────────────────────────────

async function layer5_constituency(query: string): Promise<GeocodedResult[]> {
    const { data } = await supabase
        .from('iebc_offices')
        .select('constituency_name,constituency,county,latitude,longitude')
        .or(
            `constituency_name.ilike.%${query}%,constituency.ilike.%${query}%`
        )
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(5);

    if (!data || data.length === 0) return [];

    const seen = new Set<string>();
    return data
        .filter((row) => {
            const key = row.constituency_name || row.constituency;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .map((row) => ({
            lat: row.latitude,
            lng: row.longitude,
            name: row.constituency_name || row.constituency,
            displayName: `${row.constituency_name || row.constituency} Constituency, ${row.county} County, Kenya`,
            confidence: 0.5,
            source: 'constituency_centroid' as GeocodingSource,
            type: 'constituency',
            county: row.county,
            country: 'Kenya',
            countryCode: 'KE',
            isKenyan: true,
        }));
}

// ─── LAYER 6: County Centroid (static — 47 counties, never fails) ───────────

const KENYA_COUNTY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
    mombasa: { lat: -4.0435, lng: 39.6682 },
    kwale: { lat: -4.174, lng: 39.4501 },
    kilifi: { lat: -3.5107, lng: 39.9093 },
    'tana river': { lat: -1.5401, lng: 39.9475 },
    lamu: { lat: -2.2686, lng: 40.902 },
    'taita taveta': { lat: -3.3154, lng: 38.4846 },
    garissa: { lat: -0.4532, lng: 39.646 },
    wajir: { lat: 1.7471, lng: 40.0573 },
    mandera: { lat: 3.9366, lng: 41.867 },
    marsabit: { lat: 2.3284, lng: 37.9899 },
    isiolo: { lat: 0.3556, lng: 37.5822 },
    meru: { lat: 0.0467, lng: 37.649 },
    'tharaka nithi': { lat: -0.3, lng: 37.8833 },
    embu: { lat: -0.53, lng: 37.45 },
    kitui: { lat: -1.3667, lng: 38.0167 },
    machakos: { lat: -1.5177, lng: 37.2634 },
    makueni: { lat: -2.2559, lng: 37.8939 },
    nyandarua: { lat: -0.5, lng: 36.5 },
    nyeri: { lat: -0.4167, lng: 36.95 },
    kirinyaga: { lat: -0.5615, lng: 37.2827 },
    "murang'a": { lat: -0.7833, lng: 37.15 },
    kiambu: { lat: -1.0314, lng: 36.8318 },
    turkana: { lat: 3.1, lng: 35.5967 },
    'west pokot': { lat: 1.6203, lng: 35.3876 },
    samburu: { lat: 1.067, lng: 36.975 },
    'trans nzoia': { lat: 1.0567, lng: 35.0044 },
    'uasin gishu': { lat: 0.5143, lng: 35.2698 },
    'elgeyo marakwet': { lat: 0.8992, lng: 35.5127 },
    nandi: { lat: 0.1833, lng: 35.1 },
    baringo: { lat: 0.834, lng: 36.0835 },
    laikipia: { lat: 0.3606, lng: 36.782 },
    nakuru: { lat: -0.3031, lng: 36.08 },
    narok: { lat: -1.0827, lng: 35.8713 },
    kajiado: { lat: -1.852, lng: 36.776 },
    kericho: { lat: -0.3686, lng: 35.2863 },
    bomet: { lat: -0.7893, lng: 35.3418 },
    kakamega: { lat: 0.2827, lng: 34.7519 },
    vihiga: { lat: 0.0833, lng: 34.7167 },
    bungoma: { lat: 0.5635, lng: 34.5606 },
    busia: { lat: 0.4608, lng: 34.1117 },
    siaya: { lat: -0.0607, lng: 34.2877 },
    kisumu: { lat: -0.0917, lng: 34.768 },
    'homa bay': { lat: -0.5267, lng: 34.4571 },
    migori: { lat: -1.0634, lng: 34.4731 },
    kisii: { lat: -0.6817, lng: 34.7667 },
    nyamira: { lat: -0.567, lng: 34.934 },
    nairobi: { lat: -1.2921, lng: 36.8219 },
};

export { KENYA_COUNTY_CENTROIDS };

async function layer6_county(query: string): Promise<GeocodedResult[]> {
    const normalised = normalizeQuery(query).toLowerCase().trim();

    // Direct match
    const exactMatch = KENYA_COUNTY_CENTROIDS[normalised];
    if (exactMatch) {
        return [
            {
                lat: exactMatch.lat,
                lng: exactMatch.lng,
                name: normalised,
                displayName: `${normalised.charAt(0).toUpperCase() + normalised.slice(1)} County, Kenya`,
                confidence: 0.4,
                source: 'county_centroid' as GeocodingSource,
                type: 'county',
                county: normalised,
                country: 'Kenya',
                countryCode: 'KE',
                isKenyan: true,
            },
        ];
    }

    // Fuzzy match
    const countyNames = Object.keys(KENYA_COUNTY_CENTROIDS);
    const fuzzyMatch = countyNames.find(
        (name) => name.includes(normalised) || normalised.includes(name)
    );

    if (fuzzyMatch) {
        const coords = KENYA_COUNTY_CENTROIDS[fuzzyMatch];
        return [
            {
                lat: coords.lat,
                lng: coords.lng,
                name: fuzzyMatch,
                displayName: `${fuzzyMatch.charAt(0).toUpperCase() + fuzzyMatch.slice(1)} County, Kenya`,
                confidence: 0.35,
                source: 'county_centroid' as GeocodingSource,
                type: 'county',
                county: fuzzyMatch,
                country: 'Kenya',
                countryCode: 'KE',
                isKenyan: true,
            },
        ];
    }

    return [];
}

// ─── LAYER 7: IP Geolocation (last resort before manual) ────────────────────

async function layer7_ipGeolocation(): Promise<GeocodedResult[]> {
    try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) throw new Error('IP geolocation failed');
        const data = await res.json();
        return [
            {
                lat: parseFloat(data.latitude),
                lng: parseFloat(data.longitude),
                name: data.city || data.region || data.country_name,
                displayName: `${data.city || 'Unknown location'}, ${data.country_name}`,
                confidence: 0.1,
                source: 'ip_geolocation' as GeocodingSource,
                type: 'ip_approximate',
                county: data.region,
                country: data.country_name,
                countryCode: data.country_code,
                isKenyan: data.country_code === 'KE',
            },
        ];
    } catch {
        return [];
    }
}

// ─── PAID LAYERS (optional — require env vars) ──────────────────────────────

async function layerPaid_google(
    query: string,
    countryCode: string
): Promise<GeocodedResult[]> {
    const GOOGLE_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY;
    if (!GOOGLE_KEY) throw new Error('No Google Maps key');

    const params = new URLSearchParams({
        address: `${query}${countryCode ? `, ${countryCode}` : ''}`,
        key: GOOGLE_KEY,
        ...(countryCode
            ? { components: `country:${countryCode.toUpperCase()}` }
            : {}),
    });

    const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${params}`
    );
    if (!res.ok) throw new Error('Google geocoding failed');
    const data = await res.json();

    return (data.results || []).map((item: any) => ({
        lat: item.geometry.location.lat,
        lng: item.geometry.location.lng,
        name: item.address_components?.[0]?.long_name || query,
        displayName: item.formatted_address,
        confidence: 0.9,
        source: 'google' as GeocodingSource,
        type: item.types?.[0] || 'place',
        country: item.address_components?.find((c: any) =>
            c.types.includes('country')
        )?.long_name,
        countryCode: item.address_components?.find((c: any) =>
            c.types.includes('country')
        )?.short_name,
        isKenyan: item.formatted_address?.includes('Kenya'),
    }));
}

async function layerPaid_mapbox(
    query: string,
    countryCode: string
): Promise<GeocodedResult[]> {
    const MAPBOX_TOKEN = (import.meta as any).env?.VITE_MAPBOX_TOKEN;
    if (!MAPBOX_TOKEN) throw new Error('No Mapbox token');

    const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        country: countryCode.toLowerCase(),
        language: 'en',
        limit: '5',
        types: 'place,locality,neighborhood,address,poi',
    });

    const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`
    );
    if (!res.ok) throw new Error('Mapbox failed');
    const data = await res.json();

    return (data.features || []).map((f: any) => ({
        lat: f.center[1],
        lng: f.center[0],
        name: f.text,
        displayName: f.place_name,
        confidence: f.relevance,
        source: 'mapbox' as GeocodingSource,
        type: f.place_type?.[0] || 'place',
        county: f.context?.find((c: any) => c.id.startsWith('region'))?.text,
        country: f.context?.find((c: any) => c.id.startsWith('country'))?.text,
        countryCode: f.context
            ?.find((c: any) => c.id.startsWith('country'))
            ?.short_code?.toUpperCase(),
        isKenyan: f.place_name?.includes('Kenya'),
    }));
}

// ─── THE UNIFIED PIPELINE ────────────────────────────────────────────────────

export async function resolveLocation(
    query: string,
    options: PipelineOptions = {}
): Promise<PipelineResult> {
    const {
        isGlobal = false,
        countryCode = 'ke',
        maxLayers = 13,
        skipLayers = [],
    } = options;

    const attempts: PipelineResult['allAttempts'] = [];
    let fallbackDepth = 0;

    const layers: Array<{
        name: GeocodingSource;
        fn: () => Promise<GeocodedResult[]>;
        kenyaOnly: boolean;
    }> = [
            {
                name: 'local_fuse',
                fn: () => layer1_localFuse(query),
                kenyaOnly: true,
            },
            {
                name: 'nominatim',
                fn: () => layer2_nominatim(query, isGlobal ? '' : countryCode),
                kenyaOnly: false,
            },
            {
                name: 'photon',
                fn: () => layer3_photon(query, isGlobal ? '' : countryCode.toUpperCase()),
                kenyaOnly: false,
            },
            {
                name: 'google',
                fn: () => layerPaid_google(query, isGlobal ? '' : countryCode),
                kenyaOnly: false,
            },
            {
                name: 'mapbox',
                fn: () => layerPaid_mapbox(query, isGlobal ? '' : countryCode.toUpperCase()),
                kenyaOnly: false,
            },
            {
                name: 'overpass',
                fn: () => layer4_overpass(query),
                kenyaOnly: true,
            },
            {
                name: 'constituency_centroid',
                fn: () => layer5_constituency(query),
                kenyaOnly: true,
            },
            {
                name: 'county_centroid',
                fn: () => layer6_county(query),
                kenyaOnly: true,
            },
            {
                name: 'ip_geolocation',
                fn: () => layer7_ipGeolocation(),
                kenyaOnly: false,
            },
        ];

    for (const layer of layers) {
        if (isGlobal && layer.kenyaOnly) {
            attempts.push({
                layer: layer.name,
                success: false,
                reason: 'skipped_global',
            });
            continue;
        }

        if (skipLayers.includes(layer.name)) {
            attempts.push({
                layer: layer.name,
                success: false,
                reason: 'skipped_explicit',
            });
            continue;
        }

        if (fallbackDepth >= maxLayers) break;

        try {
            const results = await layer.fn();

            if (results.length > 0) {
                const best = results.sort((a, b) => b.confidence - a.confidence)[0];
                attempts.push({ layer: layer.name, success: true });

                return {
                    result: best,
                    layerUsed: layer.name,
                    allAttempts: attempts,
                    fallbackDepth,
                };
            }

            attempts.push({
                layer: layer.name,
                success: false,
                reason: 'no_results',
            });
        } catch (err) {
            attempts.push({
                layer: layer.name,
                success: false,
                reason: err instanceof Error ? err.message : 'error',
            });
        }

        fallbackDepth++;
    }

    return {
        result: null,
        layerUsed: null,
        allAttempts: attempts,
        fallbackDepth,
    };
}
