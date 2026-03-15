export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'X-API-Key, Content-Type'
            }
        });
    }

    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
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
        const countyOfficeCounts: Record<string, number> = {};
        offices.forEach(o => {
            if (o.county) {
                countyOfficeCounts[o.county] = (countyOfficeCounts[o.county] || 0) + 1;
            }
        });

        const enriched = counties.map(c => ({
            id: c.id,
            name: c.name,
            registration_target: c.registration_target,
            governor: c.governor,
            senator: c.senator,
            total_constituency_offices: countyOfficeCounts[c.name] || 0
        }));

        return Response.json({ data: enriched, total: enriched.length }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200'
            }
        });
    } catch (err: any) {
        return Response.json({ error: err.message || 'Internal server error' }, {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
    }
}
