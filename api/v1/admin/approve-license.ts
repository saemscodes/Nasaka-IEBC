import { put } from '@vercel/blob';
import { errorResponse, corsHeaders } from '../../_lib/api-auth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
    const startTime = Date.now();
    const headers = corsHeaders();

    if (req.method === 'OPTIONS') {
        return new NextResponse(null, { status: 200, headers });
    }

    if (req.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    // 1. Admin Verification
    const adminSecret = process.env.VITE_ADMIN_PASSWORD || process.env.ADMIN_SECRET;
    const providedSecret = req.headers.get('x-admin-secret');

    if (!adminSecret || providedSecret !== adminSecret) {
        return errorResponse('Unauthorized: Invalid admin secret', 401);
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return errorResponse('Invalid JSON body', 400);
    }

    const { application_id } = body;
    if (!application_id) {
        return errorResponse('Missing application_id', 400);
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return errorResponse('Server misconfiguration', 500);
    }

    try {
        // 2. Fetch Application Record
        const appResp = await fetch(`${SUPABASE_URL}/rest/v1/nasaka_license_applications?id=eq.${application_id}&select=*`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        const appData = await appResp.json();
        if (!appData || appData.length === 0) {
            return errorResponse('License application not found', 404);
        }
        const application = appData[0];

        if (application.status === 'approved') {
            return errorResponse('Application already approved', 400);
        }

        // 3. Fetch Verified Offices for Export
        const officeResp = await fetch(`${SUPABASE_URL}/rest/v1/iebc_offices?verified=eq.true&select=id,constituency,county,office_location,latitude,longitude,confidence_score,formatted_address&order=county.asc`, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        const offices = await officeResp.json();

        // 4. Generate GeoJSON
        const geojson = {
            type: 'FeatureCollection',
            metadata: {
                generated_at: new Date().toISOString(),
                license_id: application.id,
                institution: application.institution
            },
            features: offices.map((o: any) => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [o.longitude, o.latitude]
                },
                properties: {
                    id: o.id,
                    county: o.county,
                    constituency: o.constituency,
                    location: o.office_location,
                    address: o.formatted_address,
                    confidence: o.confidence_score
                }
            }))
        };

        // 5. Generate CSV
        const csvHeaders = 'id,county,constituency,office_location,latitude,longitude,confidence_score,formatted_address';
        const csvRows = offices.map((o: any) =>
            `"${o.id}","${o.county || ''}","${o.constituency || ''}","${(o.office_location || '').replace(/"/g, '""')}","${o.latitude}","${o.longitude}","${o.confidence_score}","${(o.formatted_address || '').replace(/"/g, '""')}"`
        );
        const csvContent = [csvHeaders, ...csvRows].join('\n');

        // 6. Upload to Vercel Blob
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        const blobOptions = {
            access: 'public' as const,
            addRandomSuffix: true,
            contentType: 'application/json'
        };

        const { url: geojsonUrl } = await put(
            `licenses/${application.id}/nasaka_iebc_offices.geojson`,
            JSON.stringify(geojson),
            { ...blobOptions, contentType: 'application/geo+json' }
        );

        const { url: csvUrl } = await put(
            `licenses/${application.id}/nasaka_iebc_offices.csv`,
            csvContent,
            { ...blobOptions, contentType: 'text/csv' }
        );

        // 7. Update Database
        const updateResp = await fetch(`${SUPABASE_URL}/rest/v1/nasaka_license_applications?id=eq.${application_id}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                status: 'approved',
                approved_at: new Date().toISOString(),
                download_url: JSON.stringify({ geojson: geojsonUrl, csv: csvUrl }),
                download_expires_at: expiresAt.toISOString()
            })
        });

        if (!updateResp.ok) {
            throw new Error('Failed to update application status in database');
        }

        return Response.json({
            success: true,
            message: 'License approved and data package generated.',
            urls: { geojson: geojsonUrl, csv: csvUrl },
            expires_at: expiresAt.toISOString()
        }, { headers });

    } catch (err: any) {
        console.error('Approval Error:', err);
        return errorResponse(err.message || 'Error processing approval', 500);
    }
}
