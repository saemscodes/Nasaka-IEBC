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
    const lat = parseFloat(url.searchParams.get('lat') || '');
    const lng = parseFloat(url.searchParams.get('lng') || '');

    if (isNaN(lat) || isNaN(lng)) {
        return Response.json({
            error: 'lat and lng query parameters are required',
            usage: '/api/v1/boundary?lat=-1.286&lng=36.817'
        }, {
            status: 400,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
    }

    // Validate Kenya bounding box
    if (lat < -5.0 || lat > 5.5 || lng < 33.5 || lng > 42.0) {
        return Response.json({
            error: 'Coordinates outside Kenya bounding box (lat: -5.0 to 5.5, lng: 33.5 to 42.0)',
            provided: { lat, lng }
        }, {
            status: 400,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
    }

    try {
        // Fetch all constituency reference points
        // NOTE: constituencies table uses county_id (FK to counties.id)
        const constResp = await fetch(
            `${SUPABASE_URL}/rest/v1/constituencies?select=name,latitude,longitude,member_of_parliament,party,women_rep,counties(name)&latitude=not.is.null&longitude=not.is.null`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!constResp.ok) {
            const errText = await constResp.text();
            return Response.json({ error: `Database error: ${errText}` }, {
                status: 502,
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
            });
        }

        const constituenciesRaw: any[] = await constResp.json();
        const constituencies = constituenciesRaw.map(c => ({
            ...c,
            county: c.counties?.name || 'Unknown'
        }));

        // Find nearest constituency by Haversine distance
        let nearest: any = null;
        let minDist = Infinity;

        for (const c of constituencies) {
            const dist = haversineKm(lat, lng, c.latitude, c.longitude);
            if (dist < minDist) {
                minDist = dist;
                nearest = { ...c, distance_km: Math.round(dist * 100) / 100 };
            }
        }

        if (!nearest) {
            return Response.json({ error: 'No constituency data available' }, {
                status: 404,
                headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
            });
        }

        // Also find nearby IEBC offices
        const officeResp = await fetch(
            `${SUPABASE_URL}/rest/v1/iebc_offices?select=id,constituency,county,office_location,latitude,longitude,verified&latitude=not.is.null&longitude=not.is.null&county=eq.${encodeURIComponent(nearest.county)}&limit=20`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        let nearbyOffices: any[] = [];
        if (officeResp.ok) {
            const offices: any[] = await officeResp.json();
            nearbyOffices = offices
                .map(o => ({
                    ...o,
                    distance_km: Math.round(haversineKm(lat, lng, o.latitude, o.longitude) * 100) / 100
                }))
                .filter(o => o.distance_km < 50) // Filter to reasonable radius
                .sort((a, b) => a.distance_km - b.distance_km)
                .slice(0, 5);
        }

        return Response.json({
            data: {
                query_point: { lat, lng },
                constituency: nearest.name,
                county: nearest.county,
                member_of_parliament: nearest.member_of_parliament,
                party: nearest.party,
                women_rep: nearest.women_rep,
                constituency_center: {
                    lat: nearest.latitude,
                    lng: nearest.longitude
                },
                distance_to_constituency_center_km: nearest.distance_km,
                nearest_offices: nearbyOffices
            },
            note: 'Boundary lookup uses nearest-constituency-center approximation. For exact boundary containment, use official IEBC gazetted boundary shapefiles.'
        }, {
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
