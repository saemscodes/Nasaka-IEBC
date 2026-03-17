export const config = { runtime: 'nodejs' };

import { validateApiKey, errorResponse, corsHeaders, logApiUsage } from '../../src/api-lib/api-auth';
import { createLogger } from '../../src/api-lib/logger';

export default async function handler(req: Request): Promise<Response> {
    const logger = createLogger(req);
    const startTime = Date.now();

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders() });
    }

    if (req.method !== 'GET') {
        return errorResponse('Method not allowed', 405);
    }

    // Security & Rate Limiting
    const auth = await validateApiKey(req, { required: false });
    if (!auth.valid) {
        logger.error(auth.status, auth.error || 'Auth failed');
        return errorResponse(auth.error, auth.status, { retryAfter: auth.retryAfter });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        logger.error(500, 'Server misconfiguration');
        return errorResponse('Server misconfiguration', 500);
    }

    const url = new URL(req.url);
    const lat = parseFloat(url.searchParams.get('lat') || '');
    const lng = parseFloat(url.searchParams.get('lng') || '');
    const constituency = url.searchParams.get('constituency');
    const county = url.searchParams.get('county');
    const radiusKm = Math.min(parseFloat(url.searchParams.get('radius') || '25'), 100);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

    const hasCoords = !isNaN(lat) && !isNaN(lng);
    const hasFilter = !!(constituency || county);

    if (!hasCoords && !hasFilter) {
        return new Response(JSON.stringify({
            error: 'Provide either lat/lng coordinates or constituency/county name',
            usage: {
                by_location: '/api/v1/locate?lat=-1.286&lng=36.817&radius=25&limit=10',
                by_constituency: '/api/v1/locate?constituency=Westlands',
                by_county: '/api/v1/locate?county=Nairobi'
            }
        }), {
            status: 400,
            headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        });
    }

    // Canonical 47 Kenyan counties
    const COUNTY_NORMALIZE: Record<string, string> = {
        'MOMBASA': 'MOMBASA', 'KWALE': 'KWALE', 'KILIFI': 'KILIFI',
        'TANA RIVER': 'TANA RIVER', 'TANARIVER': 'TANA RIVER', 'TANA-RIVER': 'TANA RIVER',
        'LAMU': 'LAMU', 'TAITA TAVETA': 'TAITA TAVETA', 'TAITA-TAVETA': 'TAITA TAVETA', 'TAITA/TAVETA': 'TAITA TAVETA',
        'GARISSA': 'GARISSA', 'WAJIR': 'WAJIR', 'MANDERA': 'MANDERA',
        'MARSABIT': 'MARSABIT', 'ISIOLO': 'ISIOLO', 'MERU': 'MERU',
        'THARAKA NITHI': 'THARAKA-NITHI', 'EMBU': 'EMBU', 'KITUI': 'KITUI', 'MACHAKOS': 'MACHAKOS', 'MAKUENI': 'MAKUENI',
        'NYANDARUA': 'NYANDARUA', 'NYERI': 'NYERI', 'KIRINYAGA': 'KIRINYAGA',
        'MURANG\'A': 'MURANG\'A', 'KIAMBU': 'KIAMBU', 'TURKANA': 'TURKANA',
        'WEST POKOT': 'WEST POKOT', 'SAMBURU': 'SAMBURU',
        'TRANS NZOIA': 'TRANS-NZOIA', 'UASIN GISHU': 'UASIN GISHU',
        'ELGEYO MARAKWET': 'ELGEYO-MARAKWET', 'NANDI': 'NANDI', 'BARINGO': 'BARINGO', 'LAIKIPIA': 'LAIKIPIA', 'NAKURU': 'NAKURU',
        'NAROK': 'NAROK', 'KAJIADO': 'KAJIADO', 'KERICHO': 'KERICHO', 'BOMET': 'BOMET',
        'KAKAMEGA': 'KAKAMEGA', 'VIHIGA': 'VIHIGA', 'BUNGOMA': 'BUNGOMA', 'BUSIA': 'BUSIA',
        'SIAYA': 'SIAYA', 'KISUMU': 'KISUMU', 'HOMA BAY': 'HOMA BAY', 'MIGORI': 'MIGORI', 'KISII': 'KISII', 'NYAMIRA': 'NYAMIRA',
        'NAIROBI': 'NAIROBI'
    };

    function normalizeCounty(c: string | null): string | null {
        if (!c) return null;
        const upper = c.trim().toUpperCase();
        return COUNTY_NORMALIZE[upper] || upper;
    }

    // ---- 1. Check Upstash Redis Cache ----
    const cacheLat = hasCoords ? lat.toFixed(3) : 'null';
    const cacheLng = hasCoords ? lng.toFixed(3) : 'null';
    const cacheKey = `nasaka:locate:${cacheLat}:${cacheLng}:${constituency || 'any'}:${county || 'any'}:${radiusKm}:${limit}`;

    if (UPSTASH_URL && UPSTASH_TOKEN) {
        try {
            const cacheResp = await fetch(`${UPSTASH_URL}/get/${cacheKey}`, {
                headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
            });
            if (cacheResp.ok) {
                const { result } = await cacheResp.json();
                if (result) {
                    logger.success(200, auth.tier, 'HIT');
                    return new Response(result, {
                        headers: { ...corsHeaders(), 'Content-Type': 'application/json', 'X-Vercel-Cache': 'HIT' }
                    });
                }
            }
        } catch (e) {
            console.error('[Cache Error]:', e);
        }
    }

    try {
        // ---- 2. Supabase Query ----
        let queryUrl = `${SUPABASE_URL}/rest/v1/iebc_offices?select=id,constituency,county,office_location,latitude,longitude,verified,formatted_address,landmark&latitude=not.is.null&longitude=not.is.null&limit=200`;

        if (constituency) queryUrl += `&constituency=ilike.*${encodeURIComponent(constituency)}*`;
        if (county) {
            const normalized = normalizeCounty(county);
            queryUrl += `&county=ilike.*${encodeURIComponent(normalized || county)}*`;
        }

        const resp = await fetch(queryUrl, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // 📝 Fallback to Blob if Supabase fails
        if (!resp.ok) {
            logger.error(resp.status, 'Supabase fail, trying Blob fallback');
            const fbResp = await fetch(`https://nasaka-iebc.public.blob.vercel-storage.com/datasets/offices-latest.json`);
            if (fbResp.ok) {
                let offices = await fbResp.json();
                if (hasCoords) {
                    offices = offices.map((o: any) => ({ ...o, distance_km: Math.round(haversineKm(lat, lng, o.latitude, o.longitude) * 100) / 100 }))
                        .filter((o: any) => o.distance_km <= radiusKm)
                        .sort((a: any, b: any) => a.distance_km - b.distance_km)
                        .slice(0, limit);
                }
                const responseData = { data: offices, meta: { source: 'blob_fallback' } };
                logger.success(200, auth.tier, 'BYPASS');
                return new Response(JSON.stringify(responseData), {
                    headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
                });
            }
            return errorResponse('Database connection failed', 502);
        }

        let offices: any[] = await resp.json();

        // Spatial filtering
        if (hasCoords) {
            offices = offices.map(o => ({
                ...o,
                distance_km: Math.round(haversineKm(lat, lng, o.latitude, o.longitude) * 100) / 100
            })).filter(o => o.distance_km <= radiusKm)
                .sort((a, b) => a.distance_km - b.distance_km)
                .slice(0, limit);
        } else {
            offices = offices.slice(0, limit);
        }

        const responseData = {
            data: offices,
            query: { lat: hasCoords ? lat : undefined, lng: hasCoords ? lng : undefined, radius_km: hasCoords ? radiusKm : undefined },
            total: offices.length
        };

        // Cache the result in Upstash (5 minutes)
        if (UPSTASH_URL && UPSTASH_TOKEN) {
            fetch(`${UPSTASH_URL}/set/${cacheKey}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` },
                body: JSON.stringify(JSON.stringify(responseData))
            }).then(() => {
                fetch(`${UPSTASH_URL}/expire/${cacheKey}/300`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
                });
            }).catch(() => { });
        }

        logger.success(200, auth.tier, 'MISS');
        return new Response(JSON.stringify(responseData), {
            headers: {
                ...corsHeaders(),
                'Content-Type': 'application/json',
                'X-Vercel-Cache': 'MISS',
                'Cache-Control': 's-maxage=60, stale-while-revalidate=300'
            }
        });

    } catch (err: any) {
        logger.error(500, err.message);
        return errorResponse(err.message, 500);
    }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
