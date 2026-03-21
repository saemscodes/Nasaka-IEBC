export const config = { runtime: 'nodejs' };

const getEnv = (name: string, env?: any) => {
    return env?.[name] || process.env?.[name];
};

export default async function handler(req: Request, env?: any): Promise<Response> {
    const SUPABASE_URL = getEnv('VITE_SUPABASE_URL', env) || getEnv('SUPABASE_URL', env);
    const SUPABASE_KEY = getEnv('VITE_SUPABASE_PUBLISHABLE_KEY', env) || getEnv('SUPABASE_ANON_KEY', env);

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
