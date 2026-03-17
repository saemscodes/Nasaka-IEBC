import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { get } from '@vercel/edge-config';

// 1. Initialize Upstash Redis
const redis = Redis.fromEnv();

// 2. Define Rate Limiters (Standard Web Runtime)
const ratelimiters: Record<string, Ratelimit> = {
    jamii: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(2, '1s'), prefix: 'rl:jamii' }),
    mwananchi: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1s'), prefix: 'rl:mwananchi' }),
    taifa: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1s'), prefix: 'rl:taifa' }),
    serikali: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1s'), prefix: 'rl:serikali' }),
    enterprise: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1s'), prefix: 'rl:taifa' }),
    public: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1, '1s'), prefix: 'rl:public' }),
};

// Vercel Middleware configuration
export const config = {
    matcher: '/api/v1/:path*'
};

/**
 * Nasaka IEBC — Edge Middleware (Standard Web API Version)
 * We use the standard Request/Response architecture to avoid 'next' dependency in this Vite project.
 */
export async function middleware(req: Request) {
    const startTime = Date.now();
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    // Standard headers for all responses
    const commonHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization, x-vercel-cron-secret',
        'Content-Type': 'application/json'
    };

    // ---- 1. Handle CORS Preflight (OPTIONS) ----
    if (method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: commonHeaders });
    }

    // ---- 2. Routing Groups ----
    const publicPaths = [
        '/api/v1/stats',
        '/api/v1/locate',
        '/api/v1/counties',
        '/api/v1/offices',
        '/api/v1/billing/pricing',
        '/api/v1/auth/ceka/callback',
        '/api/v1/health'
    ];

    const systemPaths = [
        '/api/v1/billing/cron/',
        '/api/v1/billing/paystack/webhook'
    ];

    const isPublic = publicPaths.some(p => pathname.startsWith(p));
    const isSystem = systemPaths.some(p => pathname.startsWith(p));

    // ---- 3. Feature Flags (Edge Config) ----
    try {
        const flags = await get<Record<string, any>>('feature_flags');
        if (flags?.maintenance_mode) {
            return new Response(
                JSON.stringify({ error: 'System is under planned maintenance. Please try again soon.', status: 503 }),
                { status: 503, headers: commonHeaders }
            );
        }
    } catch (e) {
        // Fall through on config failure
    }

    // For Vercel Middleware, returning nothing or undefined tells the runtime to continue to origin
    if (isSystem) return;

    // ---- 3. Extract Identity ----
    const apiKey = req.headers.get('x-api-key');
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

    let tier = 'public';
    let keyHash = null;

    if (apiKey) {
        // Build the same SHA-256 hash as api-auth.ts
        const encoder = new TextEncoder();
        const data = encoder.encode(apiKey);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        keyHash = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        try {
            const cached = await redis.get<{ tier: string; locked: boolean }>(`tier:${keyHash}`);
            if (cached) {
                if (cached.locked) {
                    return new Response(
                        JSON.stringify({ error: 'Key locked. Renew subscription at https://nasakaiebc.civiceducationkenya.com/pricing' }),
                        { status: 423, headers: commonHeaders }
                    );
                }
                tier = cached.tier || 'jamii';
            } else {
                // Fall through to function (it will populate cache)
                return;
            }
        } catch (e) {
            return; // Fail open
        }
    } else if (!isPublic) {
        return new Response(
            JSON.stringify({ error: 'X-API-Key header required for this endpoint.' }),
            { status: 401, headers: commonHeaders }
        );
    }

    // ---- 4. Tier Enforcement (Edge Config) ----
    try {
        const blockedPathsConfig = await get<Record<string, string[]>>('blocked_endpoints_by_tier');
        if (blockedPathsConfig && blockedPathsConfig[tier]?.some(p => pathname.startsWith(p))) {
            return new Response(
                JSON.stringify({ error: `Endpoint restricted. ${pathname} requires a higher tier than '${tier}'.` }),
                { status: 403, headers: commonHeaders }
            );
        }
    } catch (e) {
        // Fail open
    }

    // ---- 5. Global Rate Limiting (Edge Layer) ----
    const limiter = ratelimiters[tier] || ratelimiters.public;
    const identifier = keyHash || ip.split(',')[0].trim();

    try {
        const { success, limit, remaining, reset } = await limiter.limit(identifier);

        if (!success) {
            return new Response(
                JSON.stringify({
                    error: 'Rate limit exceeded at Edge. Standard request quotas apply.',
                    tier,
                    limit,
                    remaining,
                    reset
                }),
                {
                    status: 429,
                    headers: {
                        ...commonHeaders,
                        'X-RateLimit-Limit': limit.toString(),
                        'X-RateLimit-Remaining': remaining.toString(),
                        'X-RateLimit-Reset': reset.toString(),
                        'Retry-After': '1'
                    }
                }
            );
        }
    } catch (e) {
        // Fail open
    }

    // ---- 6. Finalize ----
    console.log(`[Edge] ${method} ${pathname} | Tier: ${tier} | Status: OK`);

    // To pass custom data to the origin function in Vercel Middleware 
    // without Next.js, we add custom headers which the origin handles.
    const forwardHeaders = new Headers(req.headers);
    forwardHeaders.set('x-nasaka-tier', tier);
    forwardHeaders.set('x-nasaka-processed-at', 'edge');

    // In Vercel Middleware, returning a fetch or a new Request with modified headers works
    // but the most compatible way to just "pass through" with modified headers 
    // is to return a response with 'x-middleware-rewrite' or just return nothing.
    // However, since we want to modify headers for the origin, we use the Response method.
    return new Response(null, {
        headers: {
            'x-middleware-next': '1',
            'x-nasaka-tier': tier,
            'x-nasaka-processed-at': 'edge'
        }
    });
}
