export const config = { runtime: 'edge' };

import { validateApiKey, errorResponse, corsHeaders, logApiUsage } from '../_lib/api-auth';
import { createLogger } from '../_lib/logger';

export default async function handler(req: Request): Promise<Response> {
    const logger = createLogger(req);
    const startTime = Date.now();

    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders() });
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
        return Response.json({
            error: 'Provide either lat/lng coordinates or constituency/county name',
            usage: {
                by_location: '/api/v1/locate?lat=-1.286&lng=36.817&radius=25&limit=10',
                by_constituency: '/api/v1/locate?constituency=Westlands',
                by_county: '/api/v1/locate?county=Nairobi'
            }
        }, { status: 400, headers: corsHeaders() });
    }

    // Canonical 47 Kenyan counties — normalize variants
    const COUNTY_NORMALIZE: Record<string, string> = {
        'MOMBASA': 'MOMBASA', 'KWALE': 'KWALE', 'KILIFI': 'KILIFI',
        'TANA RIVER': 'TANA RIVER', 'TANARIVER': 'TANA RIVER', 'TANA-RIVER': 'TANA RIVER',
        'LAMU': 'LAMU', 'TAITA TAVETA': 'TAITA TAVETA', 'TAITA-TAVETA': 'TAITA TAVETA', 'TAITA/TAVETA': 'TAITA TAVETA',
        'GARISSA': 'GARISSA', 'WAJIR': 'WAJIR', 'MANDERA': 'MANDERA',
        'MARSABIT': 'MARSABIT', 'ISIOLO': 'ISIOLO', 'MERU': 'MERU',
        'THARAKA NITHI': 'THARAKA-NITHI', 'THARAKA-NITHI': 'THARAKA-NITHI', 'THARAKA NITHI ': 'THARAKA-NITHI',
        'THARAKA - NITHI': 'THARAKA-NITHI', 'THARAKA / NITHI': 'THARAKA-NITHI',
        'EMBU': 'EMBU', 'KITUI': 'KITUI', 'MACHAKOS': 'MACHAKOS', 'MAKUENI': 'MAKUENI',
        'NYANDARUA': 'NYANDARUA', 'NYERI': 'NYERI', 'KIRINYAGA': 'KIRINYAGA',
        'MURANG\'A': 'MURANG\'A', 'MURANGA': 'MURANG\'A', 'MURANG A': 'MURANG\'A',
        'KIAMBU': 'KIAMBU', 'TURKANA': 'TURKANA',
        'WEST POKOT': 'WEST POKOT', 'WESTPOKOT': 'WEST POKOT', 'WEST-POKOT': 'WEST POKOT',
        'SAMBURU': 'SAMBURU',
        'TRANS NZOIA': 'TRANS-NZOIA', 'TRANS-NZOIA': 'TRANS-NZOIA', 'TRANSNZOIA': 'TRANS-NZOIA',
        'UASIN GISHU': 'UASIN GISHU', 'UASINGISHU': 'UASIN GISHU', 'UASIN-GISHU': 'UASIN GISHU',
        'ELGEYO MARAKWET': 'ELGEYO-MARAKWET', 'ELGEYO-MARAKWET': 'ELGEYO-MARAKWET', 'ELGEYO/MARAKWET': 'ELGEYO-MARAKWET', 'KEIYO-MARAKWET': 'ELGEYO-MARAKWET',
        'ELEGEYO-MARAKWET': 'ELGEYO-MARAKWET',
        'NANDI': 'NANDI', 'BARINGO': 'BARINGO', 'LAIKIPIA': 'LAIKIPIA', 'NAKURU': 'NAKURU',
        'NAROK': 'NAROK', 'KAJIADO': 'KAJIADO', 'KERICHO': 'KERICHO', 'BOMET': 'BOMET',
        'KAKAMEGA': 'KAKAMEGA', 'VIHIGA': 'VIHIGA', 'BUNGOMA': 'BUNGOMA', 'BUSIA': 'BUSIA',
        'SIAYA': 'SIAYA', 'KISUMU': 'KISUMU',
        'HOMA BAY': 'HOMA BAY', 'HOMABAY': 'HOMA BAY', 'HOMA-BAY': 'HOMA BAY',
        'MIGORI': 'MIGORI', 'KISII': 'KISII', 'NYAMIRA': 'NYAMIRA',
        'NAIROBI': 'NAIROBI', 'NAIROBI CITY': 'NAIROBI'
    };

    function normalizeCounty(c: string | null): string | null {
        if (!c) return null;
        const upper = c.trim().toUpperCase();
        return COUNTY_NORMALIZE[upper] || upper;
    }

    try {
        // ---- 1. Vercel Data Cache (KV) Integration ----
        const cacheLat = hasCoords ? lat.toFixed(3) : 'null';
        const cacheLng = hasCoords ? lng.toFixed(3) : 'null';
        const cacheKey = `locate:${cacheLat}:${cacheLng}:${constituency || 'any'}:${county || 'any'}:${radiusKm}:${limit}`;

        let cached = null;
        try {
            const { kv } = await import('@vercel/kv');
            cached = await kv.get(cacheKey);
        } catch (e) {
            console.error('[KV Cache] Error:', e);
        }

        if (cached) {
            logger.success(200, auth.tier, 'HIT');
            return Response.json(cached, {
                headers: { ...corsHeaders(), 'X-Vercel-Cache': 'HIT' }
            });
        }

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

        // Resilience: Fallback to Blob if Supabase fails
        if (!resp.ok) {
            logger.error(resp.status, 'Supabase fetch failed, trying Blob fallback');
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
                return Response.json(responseData, { headers: corsHeaders() });
            }
            return errorResponse('Database connection failed', 502);
        }

        let offices: any[] = await resp.json();

        // Sorting and filtering
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

        // Cache the result for 5 minutes
        try {
            const { kv } = await import('@vercel/kv');
            await kv.set(cacheKey, responseData, { ex: 300 });
        } catch (e) { }

        logger.success(200, auth.tier, 'MISS');
        return Response.json(responseData, {
            headers: {
                ...corsHeaders(),
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
