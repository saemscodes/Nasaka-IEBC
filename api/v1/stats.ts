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

        const totalStations = offices.length;
        const verifiedCount = offices.filter(o => o.verified).length;
        const coordinateCount = offices.filter(o => o.latitude !== null).length;
        const uniqueCounties = new Set(offices.map(o => o.county).filter(Boolean)).size;

        const stats = {
            total_stations: totalStations,
            verified_count: verifiedCount,
            coordinate_coverage: coordinateCount,
            coordinate_coverage_pct: totalStations > 0 ? Math.round((coordinateCount / totalStations) * 100) : 0,
            verified_coverage_pct: totalStations > 0 ? Math.round((verifiedCount / totalStations) * 100) : 0,
            counties_covered: uniqueCounties,
            snapshot_timestamp: new Date().toISOString()
        };

        return Response.json({ data: stats }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
            }
        });
    } catch (err: any) {
        return Response.json({ error: err.message || 'Internal server error' }, {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
    }
}
