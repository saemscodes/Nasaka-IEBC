import { NextRequest, NextResponse } from 'next/server';

export const config = {
    matcher: '/api/v1/:path*'
};

export function middleware(req: NextRequest) {
    const pathname = req.nextUrl.pathname;
    const method = req.method;

    // 1. Handle CORS Preflight (OPTIONS)
    if (method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization, x-vercel-cron-secret'
            }
        });
    }

    // 2. Public paths that don't require an X-API-Key (they handle guest rate limiting themselves)
    const publicPaths = [
        '/api/v1/stats',
        '/api/v1/locate',
        '/api/v1/counties',
        '/api/v1/offices',
        '/api/v1/billing/pricing',
        '/api/v1/enterprise/enquire',
        '/api/v1/auth/ceka/callback',
        '/api/v1/health'
    ];

    // 3. Skip auth check for system/cron endpoints (they use specialized auth like CRON_SECRET)
    const systemPaths = [
        '/api/v1/billing/cron/',
        '/api/v1/billing/paystack/webhook'
    ];

    const isPublic = publicPaths.some(p => pathname.startsWith(p));
    const isSystem = systemPaths.some(p => pathname.startsWith(p));

    if (isPublic || isSystem) {
        return NextResponse.next();
    }

    // 4. Enforce X-API-Key for everything else
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
        return new NextResponse(
            JSON.stringify({
                error: 'Missing X-API-Key header. Get one at: https://nasakaiebc.civiceducationkenya.com/pricing',
                status: 401
            }),
            {
                status: 401,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            }
        );
    }

    // Basic key length validation (all our keys are SHA-256 hashed or long random strings > 32 chars)
    if (apiKey.length < 24) {
        return new NextResponse(
            JSON.stringify({ error: 'Invalid API key format', status: 401 }),
            {
                status: 401,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            }
        );
    }

    return NextResponse.next();
}
