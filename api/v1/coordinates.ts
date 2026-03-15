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
    const verifiedOnly = url.searchParams.get('verified') === 'true';
    const format = url.searchParams.get('format') || 'json';

    try {
        let queryUrl = `${SUPABASE_URL}/rest/v1/iebc_offices?select=id,constituency,constituency_code,county,office_location,latitude,longitude,verified,verified_latitude,verified_longitude,geocode_status,geocode_method,confidence_score,accuracy_meters,formatted_address&latitude=not.is.null&longitude=not.is.null&order=county.asc,constituency.asc`;

        if (county) queryUrl += `&county=ilike.*${encodeURIComponent(county)}*`;
        if (constituency) queryUrl += `&constituency=ilike.*${encodeURIComponent(constituency)}*`;
        if (verifiedOnly) queryUrl += `&verified=eq.true`;

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

        // GeoJSON format
        if (format === 'geojson') {
            const geojson = {
                type: 'FeatureCollection',
                features: offices.map(o => ({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [
                            o.verified_longitude || o.longitude,
                            o.verified_latitude || o.latitude
                        ]
                    },
                    properties: {
                        id: o.id,
                        constituency: o.constituency,
                        constituency_code: o.constituency_code,
                        county: o.county,
                        office_location: o.office_location,
                        verified: o.verified,
                        geocode_status: o.geocode_status,
                        geocode_method: o.geocode_method,
                        confidence_score: o.confidence_score,
                        accuracy_meters: o.accuracy_meters,
                        formatted_address: o.formatted_address
                    }
                }))
            };

            return Response.json(geojson, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/geo+json',
                    'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200'
                }
            });
        }

        // CSV format
        if (format === 'csv') {
            const header = 'id,constituency,constituency_code,county,office_location,latitude,longitude,verified_latitude,verified_longitude,verified,geocode_status,confidence_score,accuracy_meters';
            const rows = offices.map(o =>
                [o.id, `"${(o.constituency || '').replace(/"/g, '""')}"`, o.constituency_code, `"${(o.county || '').replace(/"/g, '""')}"`, `"${(o.office_location || '').replace(/"/g, '""')}"`, o.latitude, o.longitude, o.verified_latitude, o.verified_longitude, o.verified, o.geocode_status, o.confidence_score, o.accuracy_meters].join(',')
            );
            const csv = [header, ...rows].join('\n');

            return new Response(csv, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'text/csv',
                    'Content-Disposition': 'attachment; filename="iebc_office_coordinates.csv"',
                    'Cache-Control': 's-maxage=3600'
                }
            });
        }

        // Default JSON format
        const enriched = offices.map(o => ({
            id: o.id,
            constituency: o.constituency,
            constituency_code: o.constituency_code,
            county: o.county,
            office_location: o.office_location,
            coordinates: {
                latitude: o.verified_latitude || o.latitude,
                longitude: o.verified_longitude || o.longitude,
                source: o.verified_latitude ? 'verified' : 'geocoded',
                geocode_method: o.geocode_method,
                confidence_score: o.confidence_score,
                accuracy_meters: o.accuracy_meters
            },
            verification: {
                verified: o.verified,
                geocode_status: o.geocode_status,
                formatted_address: o.formatted_address
            }
        }));

        return Response.json({
            data: enriched,
            total: enriched.length,
            dataset_info: {
                source: 'Nasaka IEBC — Civic Education Kenya (CEKA)',
                license: 'Open Civic Data',
                last_updated: new Date().toISOString(),
                formats_available: ['json', 'geojson', 'csv'],
                note: 'Append ?format=geojson or ?format=csv to this URL for alternative formats'
            }
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
