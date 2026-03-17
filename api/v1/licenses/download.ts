import { validateApiKey, errorResponse, corsHeaders } from '../../_lib/api-auth';

export const config = { runtime: 'nodejs' };

/**
 * Nasaka IEBC — Secure License Data Download
 * 
 * Flow:
 * 1. Validates API Key (Bearer/X-API-Key).
 * 2. Verifies license ownership in nasaka_license_applications.
 * 3. Checks if license is approved and not expired.
 * 4. Returns the protected Vercel Blob URL (CSV or GeoJSON).
 * 
 * Usage: GET /api/v1/licenses/download?id=[license_id]&format=[geojson|csv]
 */

export default async function handler(req: Request): Promise<Response> {
    const headers = corsHeaders();

    if (req.method === 'OPTIONS') return new Response(null, { headers });
    if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

    const url = new URL(req.url);
    const licenseId = url.searchParams.get('id');
    const format = url.searchParams.get('format') || 'geojson';

    if (!licenseId) return errorResponse('Missing license id parameter', 400);

    // 1. Authenticate Request
    const auth = await validateApiKey(req);
    if (!auth.valid) return errorResponse(auth.error, auth.status);

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) return errorResponse('Server misconfiguration', 500);

    try {
        // 2. Check License Ownership & Status in Database
        const licenseResp = await fetch(
            `${SUPABASE_URL}/rest/v1/nasaka_license_applications?id=eq.${licenseId}&api_key_id=eq.${auth.keyId}&select=status,download_url,download_expires_at,institution`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const licenseData = await licenseResp.json();

        if (!licenseData || licenseData.length === 0) {
            return errorResponse('License not found or access denied for this API key.', 403);
        }

        const license = licenseData[0];

        // 3. Enforcement Logic
        if (license.status !== 'approved') {
            return errorResponse('This license application is still pending review.', 403);
        }

        const expirationDate = new Date(license.download_expires_at);
        if (new Date() > expirationDate) {
            return errorResponse('Your 30-day download window has expired. Please contact sales to regenerate.', 410);
        }

        // 4. Extract Artifact URLs
        let downloadUrls: any;
        try {
            downloadUrls = typeof license.download_url === 'string'
                ? JSON.parse(license.download_url)
                : license.download_url;
        } catch (e) {
            return errorResponse('Data package is not properly formatted. Contact support.', 500);
        }

        const finalUrl = downloadUrls[format.toLowerCase()];
        if (!finalUrl) {
            return errorResponse(`Requested format '${format}' is not available for this package. Available: ${Object.keys(downloadUrls).join(', ')}`, 400);
        }

        // 5. Successful Response
        return Response.json({
            success: true,
            license_id: licenseId,
            institution: license.institution,
            format: format.toLowerCase(),
            download_url: finalUrl,
            expires_at: license.download_expires_at,
            instructions: "Links are sensitive. Do not share outside your registered institution."
        }, { headers });

    } catch (err: any) {
        console.error('[License Download Error]', err.message);
        return errorResponse('Internal error retrieving license data.', 500);
    }
}
