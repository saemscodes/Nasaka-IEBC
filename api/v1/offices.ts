export const config = { runtime: 'edge' };

import { validateApiKey, logApiUsage, errorResponse, corsHeaders } from '../_lib/api-auth';

export default async function handler(req: Request): Promise<Response> {
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
        return errorResponse(auth.error, auth.status, { retryAfter: auth.retryAfter });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return errorResponse('Server misconfiguration', 500);
    }

    const url = new URL(req.url);
    const county = url.searchParams.get('county');
    const constituency = url.searchParams.get('constituency');
    const verified = url.searchParams.get('verified');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    try {
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

        let queryUrl = `${SUPABASE_URL}/rest/v1/iebc_offices?select=id,constituency,county,office_location,latitude,longitude,verified,formatted_address,landmark,geocode_status,confidence_score&order=county.asc,constituency.asc&limit=${limit}&offset=${offset}`;

        if (county) {
            const normalized = normalizeCounty(county);
            queryUrl += `&county=ilike.*${encodeURIComponent(normalized || county)}*`;
        }
        if (constituency) queryUrl += `&constituency=ilike.*${encodeURIComponent(constituency)}*`;
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
            const errText = await resp.text();
            return Response.json({ error: `Database error: ${errText}` }, {
                status: 502,
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
            });
        }

        let offices: any[] = await resp.json();

        // Final normalization pass on results
        offices = offices.map(o => ({
            ...o,
            county: normalizeCounty(o.county)
        }));

        const contentRange = resp.headers.get('content-range');
        const total = contentRange ? parseInt(contentRange.split('/')[1]) : offices.length;


        logApiUsage(auth.keyId, '/api/v1/offices', 'GET', 200, startTime, req);

        return Response.json({
            data: offices,
            pagination: {
                total,
                limit,
                offset,
                has_more: offset + limit < total
            }
        }, {
            headers: {
                ...corsHeaders(),
                'Cache-Control': 's-maxage=60, stale-while-revalidate=300'
            }
        });
    } catch (err: any) {
        logApiUsage(auth.keyId, '/api/v1/offices', 'GET', 500, startTime, req);
        return errorResponse(err.message || 'Internal server error', 500);
    }
}
