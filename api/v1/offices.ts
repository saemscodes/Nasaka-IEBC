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

    const url = new URL(req.url);
    const county = url.searchParams.get('county');
    const constituency = url.searchParams.get('constituency');
    const verified = url.searchParams.get('verified');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    try {
        let queryUrl = `${SUPABASE_URL}/rest/v1/iebc_offices?select=id,constituency,county,office_location,latitude,longitude,verified,formatted_address,landmark,geocode_status,confidence_score&order=county.asc,constituency.asc&limit=${limit}&offset=${offset}`;

        if (county) queryUrl += `&county=ilike.*${encodeURIComponent(county)}*`;
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

        const offices: any[] = await resp.json();
        const contentRange = resp.headers.get('content-range');
        const total = contentRange ? parseInt(contentRange.split('/')[1]) : offices.length;

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
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
                'Cache-Control': 's-maxage=60, stale-while-revalidate=300'
            }
        });
    } catch (err: any) {
        return Response.json({ error: err.message || 'Internal server error' }, {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
    }
}
