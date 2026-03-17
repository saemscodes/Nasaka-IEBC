export const config = { runtime: 'edge' };

import { put } from '@vercel/blob';

/**
 * Nasaka IEBC — Nightly Dataset Regeneration
 * Builds GeoJSON, JSON, and CSV snapshots of verified electoral offices.
 */
export default async function handler(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return new Response('Missing environment variables', { status: 500 });
    }

    try {
        console.log('[Cron] Starting verified dataset regeneration...');

        // 1. Fetch ALL verified offices with coordinates
        const queryUrl = `${SUPABASE_URL}/rest/v1/iebc_offices?select=id,constituency,county,office_location,latitude,longitude,verified,formatted_address,landmark&verified=eq.true&latitude=not.is.null&order=county.asc,constituency.asc`;

        const resp = await fetch(queryUrl, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!resp.ok) {
            throw new Error(`Supabase fetch failed: ${resp.statusText}`);
        }

        const offices = await resp.json();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const count = offices.length;

        console.log(`[Cron] Fetched ${count} verified offices. Generating formats...`);

        // 2. Generate JSON
        const jsonData = JSON.stringify(offices);
        await put('datasets/offices-latest.json', jsonData, {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false
        });

        // 3. Generate GeoJSON (RFC 7946)
        const geojson = {
            type: 'FeatureCollection',
            metadata: {
                generated: new Date().toISOString(),
                count: offices.length,
                license: 'CC-BY-4.0',
                source: 'Nasaka IEBC / Civic Education Kenya'
            },
            features: offices.map((o: any) => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(o.longitude), parseFloat(o.latitude)]
                },
                properties: {
                    id: o.id,
                    county: o.county,
                    constituency: o.constituency,
                    location: o.office_location,
                    address: o.formatted_address,
                    landmark: o.landmark
                }
            }))
        };
        await put('datasets/offices-latest.geojson', JSON.stringify(geojson), {
            access: 'public',
            contentType: 'application/geo+json',
            addRandomSuffix: false
        });

        // 4. Generate CSV
        const headers = ['id', 'county', 'constituency', 'location', 'latitude', 'longitude', 'address', 'landmark'];
        const csvRows = [
            headers.join(','),
            ...offices.map((o: any) => [
                o.id,
                `"${o.county}"`,
                `"${o.constituency}"`,
                `"${o.office_location}"`,
                o.latitude,
                o.longitude,
                `"${(o.formatted_address || '').replace(/"/g, '""')}"`,
                `"${(o.landmark || '').replace(/"/g, '""')}"`
            ].join(','))
        ];
        await put('datasets/offices-latest.csv', csvRows.join('\n'), {
            access: 'public',
            contentType: 'text/csv',
            addRandomSuffix: false
        });

        console.log(`[Cron] Success: Regenerated datasets for ${count} offices.`);

        return new Response(JSON.stringify({
            success: true,
            count,
            timestamp,
            files: ['offices-latest.json', 'offices-latest.geojson', 'offices-latest.csv']
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('[Cron] Dataset regeneration FAILED:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
