export const config = { runtime: 'nodejs' };

const getEnv = (name: string, env?: any) => {
    return env?.[name] || process.env?.[name];
};

export default async function handler(req: Request, env?: any): Promise<Response> {
    if (req.method === 'OPTIONS') {
        // ... (OPTIONS block)
    }

    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const SUPABASE_URL = getEnv('VITE_SUPABASE_URL', env) || getEnv('SUPABASE_URL', env);
    const SUPABASE_KEY = getEnv('VITE_SUPABASE_PUBLISHABLE_KEY', env) || getEnv('SUPABASE_ANON_KEY', env) || getEnv('VITE_SUPABASE_ANON_KEY', env);

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return Response.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const url = new URL(req.url);
    const county = url.searchParams.get('county');
    const constituency = url.searchParams.get('constituency');
    const ward = url.searchParams.get('ward');
    const verifiedOnly = url.searchParams.get('verified') === 'true';
    const table = url.searchParams.get('table') || 'iebc_offices';
    const format = url.searchParams.get('format') || 'json';

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

    try {
        let tableName = 'iebc_offices';
        let selectFields = 'id,constituency,constituency_code,county,ward,office_location,latitude,longitude,verified,verified_latitude,verified_longitude,geocode_status,geocode_method,confidence_score,accuracy_meters,formatted_address';

        if (table === 'diaspora_registration_centres') {
            tableName = 'diaspora_registration_centres';
            selectFields = 'id,mission_name,city,country,continent,latitude,longitude,address,geocode_status,geocode_method,geocode_confidence,formatted_address';
        }

        let queryUrl = `${SUPABASE_URL}/rest/v1/${tableName}?select=${selectFields}&latitude=not.is.null&longitude=not.is.null`;

        if (tableName === 'iebc_offices') {
            queryUrl += `&order=county.asc,constituency.asc`;
            if (county) {
                const normalized = normalizeCounty(county);
                queryUrl += `&county=ilike.*${encodeURIComponent(normalized || county)}*`;
            }
            if (constituency) queryUrl += `&constituency=ilike.*${encodeURIComponent(constituency)}*`;
            if (ward) queryUrl += `&ward=ilike.*${encodeURIComponent(ward)}*`;
            if (verifiedOnly) queryUrl += `&verified=eq.true`;
        } else {
            queryUrl += `&order=country.asc,city.asc`;
        }

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

        // Normalization pass
        offices = offices.map(o => ({
            ...o,
            county: normalizeCounty(o.county)
        }));

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
                        name: o.mission_name || o.constituency,
                        constituency: o.constituency,
                        constituency_code: o.constituency_code,
                        county: o.county,
                        country: o.country,
                        city: o.city,
                        ward: o.ward,
                        office_location: o.office_location || o.address,
                        verified: !!o.verified,
                        geocode_status: o.geocode_status,
                        geocode_method: o.geocode_method,
                        confidence_score: o.confidence_score || o.geocode_confidence,
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
            const isOffices = tableName === 'iebc_offices';
            const header = isOffices
                ? 'id,constituency,constituency_code,county,ward,office_location,latitude,longitude,verified,geocode_status,confidence_score'
                : 'id,mission_name,city,country,continent,latitude,longitude,geocode_status,geocode_confidence';

            const rows = offices.map(o => {
                if (isOffices) {
                    return [o.id, `"${(o.constituency || '').replace(/"/g, '""')}"`, o.constituency_code, `"${(o.county || '').replace(/"/g, '""')}"`, `"${(o.ward || '').replace(/"/g, '""')}"`, `"${(o.office_location || '').replace(/"/g, '""')}"`, o.latitude, o.longitude, o.verified, o.geocode_status, o.confidence_score].join(',');
                } else {
                    return [o.id, `"${(o.mission_name || '').replace(/"/g, '""')}"`, `"${(o.city || '').replace(/"/g, '""')}"`, `"${(o.country || '').replace(/"/g, '""')}"`, o.continent, o.latitude, o.longitude, o.geocode_status, o.geocode_confidence].join(',');
                }
            });
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
            name: o.mission_name || o.constituency,
            context: o.country || o.county,
            location: o.city || o.ward || o.office_location,
            coordinates: {
                latitude: o.verified_latitude || o.latitude,
                longitude: o.verified_longitude || o.longitude,
                source: o.verified_latitude ? 'verified' : 'geocoded',
                geocode_method: o.geocode_method,
                confidence_score: o.confidence_score || o.geocode_confidence,
            },
            address: o.formatted_address || o.address,
            table: tableName
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
