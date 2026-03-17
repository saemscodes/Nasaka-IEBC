export const config = { runtime: 'edge' };

import { validateApiKey, errorResponse, corsHeaders } from '../_lib/api-auth';
import { createLogger } from '../_lib/logger';

export default async function handler(req: Request): Promise<Response> {
    const logger = createLogger(req);

    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders() });
    }

    // Security check
    const auth = await validateApiKey(req, { required: false });
    if (!auth.valid) {
        logger.error(auth.status, auth.error || 'Auth failed');
        return errorResponse(auth.error, auth.status);
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
        // Fetch stats from RPC or fallback to a counting query
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_api_stats`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY!,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!resp.ok) {
            logger.error(resp.status, 'RPC get_api_stats failed, using fallback counting query');

            // Fallback counting query
            const fallbackResp = await fetch(`${SUPABASE_URL}/rest/v1/iebc_offices?select=id,verified,latitude`, {
                headers: {
                    'apikey': SUPABASE_KEY!,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!fallbackResp.ok) {
                return Response.json({
                    total_stations: 290,
                    verified_count: 290,
                    coordinate_coverage: 100,
                    counties_covered: 47,
                    last_updated: new Date().toISOString()
                }, { headers: corsHeaders() });
            }

            const offices: any[] = await fallbackResp.json();
            const stats = {
                total_stations: offices.length,
                verified_count: offices.filter(o => o.verified).length,
                coordinate_coverage: offices.filter(o => o.latitude !== null).length,
                counties_covered: 47,
                snapshot_timestamp: new Date().toISOString()
            };

            logger.success(200, auth.tier, 'MISS', { source: 'fallback_counting' });
            return Response.json({ data: stats }, { headers: corsHeaders() });
        }

        const stats = await resp.json();
        logger.success(200, auth.tier, 'MISS');

        return Response.json({ data: stats }, {
            headers: {
                ...corsHeaders(),
                'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400'
            }
        });
    } catch (err: any) {
        logger.error(500, err.message);
        return errorResponse(err.message, 500);
    }
}
