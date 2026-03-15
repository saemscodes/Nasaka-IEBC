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
    const lat = parseFloat(url.searchParams.get('lat') || '');
    const lng = parseFloat(url.searchParams.get('lng') || '');
    const constituency = url.searchParams.get('constituency');
    const ward = url.searchParams.get('ward');
    const county = url.searchParams.get('county');
    const radiusKm = Math.min(parseFloat(url.searchParams.get('radius') || '25'), 100);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

    // Must have either lat/lng OR constituency/ward/county
    const hasCoords = !isNaN(lat) && !isNaN(lng);
    const hasFilter = !!(constituency || ward || county);

    if (!hasCoords && !hasFilter) {
        return Response.json({
            error: 'Provide either lat/lng coordinates or constituency/ward/county name',
            usage: {
                by_location: '/api/v1/locate?lat=-1.286&lng=36.817&radius=25&limit=10',
                by_constituency: '/api/v1/locate?constituency=Westlands',
                by_county: '/api/v1/locate?county=Nairobi'
            }
        }, {
            status: 400,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
    }

    try {
        let queryUrl = `${SUPABASE_URL}/rest/v1/iebc_offices?select=id,constituency,county,office_location,latitude,longitude,verified,formatted_address,landmark,confidence_score,geocode_status&latitude=not.is.null&longitude=not.is.null&order=county.asc,constituency.asc&limit=${limit}`;

        if (constituency) queryUrl += `&constituency=ilike.*${encodeURIComponent(constituency)}*`;
        if (county) queryUrl += `&county=ilike.*${encodeURIComponent(county)}*`;

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

        let offices: any[] = await resp.json();

        // If lat/lng provided, compute distances and sort by nearest
        if (hasCoords) {
            offices = offices.map(o => {
                const distKm = haversineKm(lat, lng, o.latitude, o.longitude);
                return { ...o, distance_km: Math.round(distKm * 100) / 100 };
            });

            // Filter by radius
            offices = offices.filter(o => o.distance_km <= radiusKm);

            // Sort by distance
            offices.sort((a, b) => a.distance_km - b.distance_km);

            // Limit
            offices = offices.slice(0, limit);
        }

        return Response.json({
            data: offices,
            query: {
                lat: hasCoords ? lat : undefined,
                lng: hasCoords ? lng : undefined,
                constituency: constituency || undefined,
                county: county || undefined,
                radius_km: hasCoords ? radiusKm : undefined
            },
            total: offices.length
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

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
