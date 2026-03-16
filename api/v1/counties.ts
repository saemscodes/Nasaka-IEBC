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
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/counties?select=id,name,registration_target,governor,senator,total_count&order=name.asc`, {
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

        const counties: any[] = await resp.json();

        // Enrich with office counts per county
        const officeResp = await fetch(`${SUPABASE_URL}/rest/v1/iebc_offices?select=county`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const offices: any[] = officeResp.ok ? await officeResp.json() : [];

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

        const countyOfficeCounts: Record<string, number> = {};
        offices.forEach(o => {
            const normalized = normalizeCounty(o.county);
            if (normalized) {
                countyOfficeCounts[normalized] = (countyOfficeCounts[normalized] || 0) + 1;
            }
        });

        const enriched = counties.map(c => {
            const canonicalName = normalizeCounty(c.name) || c.name;
            return {
                id: c.id,
                name: canonicalName,
                registration_target: c.registration_target,
                governor: c.governor,
                senator: c.senator,
                total_constituency_offices: countyOfficeCounts[canonicalName] || 0
            };
        });


        logApiUsage(auth.keyId, '/api/v1/counties', 'GET', 200, startTime, req);

        return Response.json({ data: enriched, total: enriched.length }, {
            headers: {
                ...corsHeaders(),
                'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800'
            }
        });
    } catch (err: any) {
        logApiUsage(auth.keyId, '/api/v1/counties', 'GET', 500, startTime, req);
        return errorResponse(err.message || 'Internal server error', 500);
    }
}
