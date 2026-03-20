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
    const ward = url.searchParams.get('ward'); // NEW
    const county = url.searchParams.get('county');
    const q = url.searchParams.get('q');
    const radiusKm = Math.min(parseFloat(url.searchParams.get('radius') || '25'), 100);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
    const includeDiaspora = url.searchParams.get('include_diaspora') === 'true';

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

    const hasCoords = !isNaN(lat) && !isNaN(lng);
    const hasFilter = !!(constituency || county || ward);
    const hasTextQuery = !!q?.trim();

    if (!hasCoords && !hasFilter && !hasTextQuery) {
        return new Response(JSON.stringify({
            error: 'Provide either lat/lng coordinates, constituency/ward/county name, or q (text query)',
            usage: {
                by_location: '/api/v1/locate?lat=-1.286&lng=36.817&radius=25&limit=10',
                by_ward: '/api/v1/locate?ward=West%20Kabras',
                by_diaspora: '/api/v1/locate?q=London&include_diaspora=true'
            }
        }), {
            status: 400,
            headers: { ...corsHeaders(), 'Content-Type': 'application/json' }
        });
    }

    // Check if coords are outside Kenya
    const isOutsideKenya = hasCoords && (lat < -5.0 || lat > 5.2 || lng < 33.8 || lng > 42.0);
    const shouldSearchDiaspora = includeDiaspora || isOutsideKenya;

    // ---- 1. Check Upstash Redis Cache ----
    const cacheKey = `nasaka:locate:v10:${hasCoords ? lat.toFixed(3) : 'X'}:${hasCoords ? lng.toFixed(3) : 'X'}:${constituency || 'any'}:${ward || 'any'}:${county || 'any'}:${q || 'none'}:${radiusKm}:${limit}:${shouldSearchDiaspora}`;

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
        let results: any[] = [];
        let sourceMetrics = 'none';

        // ---- 2a. Diaspora Path (if outside Kenya or explicitly requested) ----
        if (shouldSearchDiaspora) {
            if (hasCoords) {
                // Proximity search for Diaspora
                const rpcResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_nearest_kenyan_mission`, {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        search_lat: lat,
                        search_lng: lng,
                        max_results: limit
                    }),
                });
                if (rpcResp.ok) {
                    results = await rpcResp.json();
                    sourceMetrics = 'rpc_diaspora_proximity';
                }
            } else if (hasTextQuery) {
                // Text search for Diaspora
                const queryStr = q || '';
                const diasporaUrl = `${SUPABASE_URL}/rest/v1/diaspora_registration_centres?or=(mission_name.ilike.*${encodeURIComponent(queryStr)}*,city.ilike.*${encodeURIComponent(queryStr)}*,country.ilike.*${encodeURIComponent(queryStr)}*)&limit=${limit}`;
                const dResp = await fetch(diasporaUrl, {
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (dResp.ok) {
                    results = await dResp.json();
                    sourceMetrics = 'diaspora_text_search';
                }
            }
        }

        // ---- 2b. Kenya RPC path: text query + proximity (v2 Ward-Aware) ----
        if (results.length === 0 && (hasTextQuery || hasCoords)) {
            const rpcBody: any = {
                search_query: q || ward || constituency || '',
                radius_km: radiusKm,
                max_results: limit,
            };
            if (hasCoords) {
                rpcBody.search_lat = lat;
                rpcBody.search_lng = lng;
            }

            const rpcResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_offices_by_text_and_location_v2`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(rpcBody),
            });

            if (rpcResp.ok) {
                results = await rpcResp.json();
                sourceMetrics = 'rpc_v2_kenya';
            }
        }

        // ---- 2c. Legacy / Direct PostgREST Fallback ----
        if (results.length === 0) {
            let queryUrl = `${SUPABASE_URL}/rest/v1/iebc_offices?select=id,constituency,county,ward,office_location,latitude,longitude,verified,formatted_address&limit=${limit}`;
            if (constituency) queryUrl += `&constituency=ilike.*${encodeURIComponent(constituency)}*`;
            if (ward) queryUrl += `&ward=ilike.*${encodeURIComponent(ward)}*`;
            if (county) queryUrl += `&county=ilike.*${encodeURIComponent(county)}*`;

            const resp = await fetch(queryUrl, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            if (resp.ok) {
                results = await resp.json();
                sourceMetrics = 'postgrest_fallback';
            }
        }

        const responseData = {
            data: results,
            query: { q, lat, lng, ward, constituency, county, radius_km: radiusKm },
            total: results.length,
            meta: { source: sourceMetrics, timestamp: new Date().toISOString() }
        };

        // Cache the result (5 minutes)
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
