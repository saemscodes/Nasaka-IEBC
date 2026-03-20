// src/lib/geocode-cached.ts
// Cached geocoding via Upstash Redis — 7-day TTL
// Falls back to raw Nominatim on cache miss

import { geocodeKenyaPlace, GeocodedPlace } from './geocode';

const UPSTASH_URL = import.meta.env.VITE_UPSTASH_URL;
const UPSTASH_TOKEN = import.meta.env.VITE_UPSTASH_TOKEN;
const TTL = 60 * 60 * 24 * 7; // 7 days

async function upstashGet(key: string): Promise<string | null> {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
    try {
        const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.result || null;
    } catch {
        return null;
    }
}

async function upstashSet(key: string, value: string): Promise<void> {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
    try {
        await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}/EX/${TTL}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        });
    } catch {
        // Cache write failure is non-critical
    }
}

export async function geocodeCached(query: string): Promise<GeocodedPlace[]> {
    const cacheKey = `geocode:ke:${query.toLowerCase().trim()}`;

    // Check cache first
    const cached = await upstashGet(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch {
            // Corrupted cache entry — fall through to Nominatim
        }
    }

    // Cache miss — hit Nominatim
    const results = await geocodeKenyaPlace(query);

    // Cache the results
    if (results.length > 0) {
        await upstashSet(cacheKey, JSON.stringify(results));
    }

    return results;
}

// ─── Full Pipeline Cache Wrapper ─────────────────────────────────────────────
// Wraps the 13-layer pipeline with Upstash caching (30-day TTL)

import { resolveLocation, PipelineResult, PipelineOptions, GeocodedResult } from '@/lib/geocoding/pipeline';

const PIPELINE_TTL = 60 * 60 * 24 * 30; // 30 days — place names are stable

export async function pipelineGeocodeWithCache(
    query: string,
    options: PipelineOptions = {}
): Promise<PipelineResult> {
    const scope = options.isGlobal ? 'global' : 'ke';
    const cacheKey = `pipeline:${scope}:${query.toLowerCase().trim()}`;

    // Check cache first
    const cached = await upstashGet(cacheKey);
    if (cached) {
        try {
            const result: GeocodedResult = JSON.parse(cached);
            return {
                result,
                layerUsed: result.source,
                allAttempts: [{ layer: result.source, success: true, reason: 'cache_hit' }],
                fallbackDepth: -1,
            };
        } catch {
            // Corrupted cache — fall through to pipeline
        }
    }

    // Run the full multi-layer pipeline
    const pipelineResult = await resolveLocation(query, options);

    // Cache successful results (use longer TTL than Nominatim-only cache)
    if (pipelineResult.result) {
        await upstashSetWithTTL(cacheKey, JSON.stringify(pipelineResult.result), PIPELINE_TTL);
    }

    return pipelineResult;
}

async function upstashSetWithTTL(key: string, value: string, ttl: number): Promise<void> {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
    try {
        await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}/EX/${ttl}`, {
            headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        });
    } catch {
        // Cache write failure is non-critical
    }
}

export type { GeocodedPlace };
export type { GeocodedResult, PipelineResult, PipelineOptions };
