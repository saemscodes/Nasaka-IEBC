export const config = { runtime: 'nodejs' };

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

    try {
        let queryUrl = `${SUPABASE_URL}/rest/v1/iebc_offices?select=id,constituency,county,office_location,formatted_address,verified,geocode_status,latitude,longitude&order=county.asc,constituency.asc`;

        if (county) queryUrl += `&county=ilike.*${encodeURIComponent(county)}*`;
        if (constituency) queryUrl += `&constituency=ilike.*${encodeURIComponent(constituency)}*`;

        const resp = await fetch(queryUrl, {
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

        // Determine operational status based on verification and geocode data
        const enriched = offices.map(o => {
            let operational_status = 'unknown';
            let registration_open = false;

            if (o.verified && o.geocode_status === 'verified_accurate') {
                operational_status = 'verified_active';
                registration_open = true;
            } else if (o.verified) {
                operational_status = 'verified';
                registration_open = true;
            } else if (o.geocode_status === 'resolved') {
                operational_status = 'located_unverified';
                registration_open = true;
            } else if (o.geocode_status === 'no_results' || o.geocode_status === 'failed') {
                operational_status = 'location_unconfirmed';
            } else {
                operational_status = 'pending_verification';
            }

            return {
                id: o.id,
                constituency: o.constituency,
                county: o.county,
                office_location: o.office_location,
                formatted_address: o.formatted_address,
                operational_status,
                registration_open,
                has_coordinates: o.latitude !== null && o.longitude !== null,
                verification_status: o.geocode_status || 'unknown',
                last_verified: o.verified ? 'verified' : 'unverified'
            };
        });

        // Summary by status
        const statusSummary: Record<string, number> = {};
        enriched.forEach(o => {
            statusSummary[o.operational_status] = (statusSummary[o.operational_status] || 0) + 1;
        });

        return Response.json({
            data: enriched,
            summary: statusSummary,
            total: enriched.length,
            note: 'IEBC registration is typically available Monday-Friday 8:00-17:00 EAT. Verify directly before visiting.'
        }, {
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
