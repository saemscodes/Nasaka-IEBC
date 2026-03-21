export const config = { runtime: 'nodejs' };

import { validateApiKey, errorResponse, corsHeaders, logApiUsage, deductCredits } from '../../src/api-lib/api-auth';
import { createLogger } from '../../src/api-lib/logger';

const getEnv = (name: string, env?: any) => {
    return env?.[name] || process.env?.[name];
};

export default async function handler(req: Request, env?: any): Promise<Response> {
    const logger = createLogger(req);
    const startTime = Date.now();

    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders() });
    }

    if (req.method !== 'GET') {
        return errorResponse('Method not allowed', 405);
    }

    // Security & Rate Limiting (Public allowed but limited)
    const auth = await validateApiKey(req, { required: false });
    if (!auth.valid) {
        logger.error(auth.status, auth.error || 'Auth failed');
        return errorResponse(auth.error, auth.status, { retryAfter: auth.retryAfter });
    }

    const SUPABASE_URL = getEnv('VITE_SUPABASE_URL', env) || getEnv('SUPABASE_URL', env);
    const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY', env);

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        logger.error(500, 'Server misconfiguration');
        return errorResponse('Server misconfiguration', 500);
    }

    const url = new URL(req.url);
    const county = url.searchParams.get('county');
    const constituency = url.searchParams.get('constituency');
    const ward = url.searchParams.get('ward');
    const verified = url.searchParams.get('verified');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // ---- 1. REQUEST COST WEIGHTING ----
    let weight = 1;
    if (limit > 100) weight += 1;
    if (!county && !constituency && !ward) weight += 1; // Heavy full-database scan

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
        let queryUrl = `${SUPABASE_URL}/rest/v1/iebc_offices?select=id,constituency,county,ward,office_location,latitude,longitude,verified,formatted_address,landmark,geocode_status,confidence_score&order=county.asc,constituency.asc&limit=${limit}&offset=${offset}`;

        if (county) {
            const normalized = normalizeCounty(county);
            queryUrl += `&county=ilike.*${encodeURIComponent(normalized || county)}*`;
        }
        if (constituency) queryUrl += `&constituency=ilike.*${encodeURIComponent(constituency)}*`;
        if (ward) queryUrl += `&ward=ilike.*${encodeURIComponent(ward)}*`;
        if (verified === 'true') queryUrl += `&verified=eq.true`;
        if (verified === 'false') queryUrl += `&verified=eq.false`;

        const resp = await fetch(queryUrl, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'count=exact'
            }
        });

        if (!resp.ok) {
            // Blob fallback...
            const BLOB_FALLBACK_URL = `https://nasaka-iebc.public.blob.vercel-storage.com/datasets/offices-latest.json`;
            const fbResp = await fetch(BLOB_FALLBACK_URL);
            if (fbResp.ok) {
                const fbData = await fbResp.json();
                logger.success(200, auth.tier, 'BYPASS');
                return Response.json({ data: fbData.slice(offset, offset + limit), meta: { source: 'static_fallback' } }, { headers: corsHeaders() });
            }
            return errorResponse('Database connection failed', 502);
        }

        let offices: any[] = await resp.json();

        // ---- 2. TIER-BASED RESPONSE SHAPING ----
        const isLowTier = auth.tier === 'jamii' || auth.tier === 'public' || auth.tier === 'free';

        offices = offices.map(o => {
            const normalized = {
                ...o,
                county: normalizeCounty(o.county)
            };

            // Remove premium fields for low-tier users
            if (isLowTier) {
                delete (normalized as any).confidence_score;
                delete (normalized as any).landmark;
                delete (normalized as any).geocode_status;
            }

            return normalized;
        });

        const contentRange = resp.headers.get('content-range');
        const total = contentRange ? parseInt(contentRange.split('/')[1]) : offices.length;

        // Log usage with weight
        logApiUsage(auth.keyId, '/api/v1/offices', 'GET', 200, startTime, req, weight);
        deductCredits(auth.keyId, weight);
        logger.success(200, auth.tier, 'MISS', { weight });

        return Response.json({
            data: offices,
            pagination: { total, limit, offset, has_more: offset + limit < total },
            meta: { tier: auth.tier, shaped: isLowTier, timestamp: new Date().toISOString() }
        }, {
            headers: {
                ...corsHeaders(),
                'Cache-Control': 's-maxage=60, stale-while-revalidate=300'
            }
        });
    } catch (err: any) {
        logger.error(500, err.message);
        return errorResponse(err.message, 500);
    }
}
