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

    try {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/iebc_offices?select=id,verified,latitude,county`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!resp.ok) {
            const errText = await resp.text();
            return Response.json({ error: `Database error: ${errText}` }, {
                status: 502,
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
            });
        }

        const offices: any[] = await resp.json();

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


        function normalizeCounty(county: string | null): string | null {
            if (!county) return null;
            const upper = county.trim().toUpperCase();
            return COUNTY_NORMALIZE[upper] || upper;
        }

        const totalStations = offices.length;
        const verifiedCount = offices.filter(o => o.verified).length;
        const coordinateCount = offices.filter(o => o.latitude !== null).length;
        const uniqueCounties = new Set(offices.map(o => normalizeCounty(o.county)).filter(Boolean)).size;

        const stats = {
            total_stations: totalStations,
            verified_count: verifiedCount,
            coordinate_coverage: coordinateCount,
            coordinate_coverage_pct: totalStations > 0 ? Math.round((coordinateCount / totalStations) * 100) : 0,
            verified_coverage_pct: totalStations > 0 ? Math.round((verifiedCount / totalStations) * 100) : 0,
            counties_covered: uniqueCounties,
            snapshot_timestamp: new Date().toISOString()
        };

        logApiUsage(auth.keyId, '/api/v1/stats', 'GET', 200, startTime, req);

        return Response.json({ data: stats }, {
            headers: {
                ...corsHeaders(),
                'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
            }
        });
    } catch (err: any) {
        logApiUsage(auth.keyId, '/api/v1/stats', 'GET', 500, startTime, req);
        return errorResponse(err.message || 'Internal server error', 500);
    }
}
