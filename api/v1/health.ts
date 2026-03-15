export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

    const status = {
        status: "operational",
        services: {
            api_gateway: "ok",
            edge_runtime: "ok",
            database_connectivity: SUPABASE_URL ? "configured" : "missing",
            auth_layer: "initialized"
        },
        version: "1.2.0",
        timestamp: new Date().toISOString()
    };

    return Response.json(status, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
        }
    });
}
