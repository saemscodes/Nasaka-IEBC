import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { get } from '@vercel/edge-config';

// Initialize Redis from environment
const redis = Redis.fromEnv();

// Define Rate Limiters (using standard Edge-compatible sliding window)
const ratelimiters: Record<string, Ratelimit> = {
    jamii: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(2, '1s'), prefix: 'rl:jamii' }),
    mwananchi: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1s'), prefix: 'rl:mwananchi' }),
    taifa: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1s'), prefix: 'rl:taifa' }),
    serikali: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '1s'), prefix: 'rl:serikali' }),
    enterprise: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1s'), prefix: 'rl:taifa' }),
    public: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1, '1s'), prefix: 'rl:public' }),
};

// Vercel Middleware configuration (Edge only)
export const config = {
    runtime: 'nodejs',
    matcher: '/api/v1/:path*'
};

/**
 * Nasaka IEBC — Edge Middleware
 * Pure Web API implementation (no Next.js / next/server).
 */
export async function middleware(req: Request): Promise<Response | void> {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;

    // Standard headers
    const commonHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization, x-vercel-cron-secret',
        'Content-Type': 'application/json'
    };

    // 1. CORS Preflight
    if (method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: commonHeaders });
    }

    // 2. Path Filters
    const publicPaths = ['/api/stats', '/api/locate', '/api/counties', '/api/offices', '/api/billing/pricing'];
    if (publicPaths.some(p => pathname.startsWith(p))) {
        // Continue to origin (null return in Vercel Edge for passthrough)
        return;
    }

    // 3. Maintenance Mode (Edge Config)
    try {
        const flags = await get<Record<string, any>>('feature_flags');
        if (flags?.maintenance_mode) {
            return new Response(
                JSON.stringify({ error: 'System is under planned maintenance.', status: 503 }),
                { status: 503, headers: commonHeaders }
            );
        }
    } catch { /* fail open */ }

    // 4. Identity & Authentication
    const apiKey = req.headers.get('x-api-key');
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

    let tier = 'public';
    let keyHash = null;

    if (apiKey) {
        // SHA-256 for key lookup
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
        keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        try {
            const cached = await redis.get<{ tier: string; locked: boolean }>(`tier:${keyHash}`);
            if (cached) {
                if (cached.locked) {
                    return new Response(
                        JSON.stringify({ error: 'Key locked. Please check your billing dashboard.' }),
                        { status: 423, headers: commonHeaders }
                    );
                }
                tier = cached.tier || 'jamii';
            } else {
                return; // Let the origin function handle verification and cache population
            }
        } catch { return; }
    } else {
        // Keys are required for non-public paths
        return new Response(
            JSON.stringify({ error: 'X-API-Key header required.' }),
            { status: 401, headers: commonHeaders }
        );
    }

    // 5. Rate Limiting
    const limiter = ratelimiters[tier] || ratelimiters.public;
    const identifier = keyHash || ip.split(',')[0].trim();

    try {
        const { success, limit, remaining, reset } = await limiter.limit(identifier);
        if (!success) {
            return new Response(
                JSON.stringify({ error: 'Rate limit exceeded at edge.', tier, limit, remaining, reset }),
                { status: 429, headers: commonHeaders }
            );
        }
    } catch { /* fail open */ }

    // Final Passthrough: Add tier header for origin logging
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-nasaka-tier', tier);
    requestHeaders.set('x-nasaka-processed-at', 'edge');

    // Return undefined to continue with original if no response returned
    return;
}
