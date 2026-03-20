// api/v1/sandbox/request.ts
// Nasaka IEBC Sandbox — Request Proxy
// Validates sandbox key, enforces limits, returns fixture data

export const config = { runtime: 'nodejs' };

import { corsHeaders } from '../../../src/api-lib/api-auth';
import { getSandboxResponse } from '../../../src/data/sandbox-fixtures';
import { getSession, consumeRequest } from './init';

export default async function handler(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders() });
    }

    if (req.method !== 'GET') {
        return Response.json(
            { error: 'Method not allowed. Sandbox only supports GET requests.' },
            { status: 405, headers: corsHeaders() }
        );
    }

    const sandboxKey = req.headers.get('X-Sandbox-Key') || req.headers.get('x-sandbox-key');

    if (!sandboxKey || !sandboxKey.startsWith('nsk_sandbox_')) {
        return Response.json(
            { error: 'Invalid or missing X-Sandbox-Key header. Activate a sandbox session first at POST /api/v1/sandbox/init' },
            { status: 401, headers: corsHeaders() }
        );
    }

    // Validate session
    const session = getSession(sandboxKey);
    if (!session) {
        return Response.json(
            { error: 'Sandbox session expired or not found. Create a new session at POST /api/v1/sandbox/init' },
            { status: 401, headers: corsHeaders() }
        );
    }

    // Consume a request
    const consumption = consumeRequest(sandboxKey);
    if (!consumption.allowed) {
        const status = consumption.retryAfter ? 429 : 429;
        return Response.json(
            {
                error: consumption.retryAfter
                    ? 'Sandbox burst rate exceeded. Max 1 request per second.'
                    : 'Sandbox request quota exhausted. Create a new session or upgrade to a paid tier at /pricing',
                requests_remaining: consumption.remaining,
                retry_after: consumption.retryAfter || null,
            },
            {
                status,
                headers: {
                    ...corsHeaders(),
                    ...(consumption.retryAfter ? { 'Retry-After': String(consumption.retryAfter) } : {}),
                },
            }
        );
    }

    // Parse endpoint from query string
    const url = new URL(req.url);
    const endpoint = url.searchParams.get('endpoint');

    if (!endpoint) {
        return Response.json(
            {
                error: 'Missing ?endpoint= parameter. Available: health, offices, counties, locate, stats',
                requests_remaining: consumption.remaining,
            },
            { status: 400, headers: corsHeaders() }
        );
    }

    // Forward all other params to the fixture router
    const params = new URLSearchParams();
    for (const [key, value] of url.searchParams) {
        if (key !== 'endpoint') {
            params.set(key, value);
        }
    }

    const startTime = Date.now();
    const response = getSandboxResponse(endpoint, params);
    const latencyMs = Date.now() - startTime;

    // Check if the endpoint was valid
    if (response.meta?.error) {
        return Response.json(
            {
                error: response.meta.error,
                requests_remaining: consumption.remaining,
            },
            { status: 400, headers: corsHeaders() }
        );
    }

    return Response.json(
        {
            ...response,
            _sandbox: {
                requests_remaining: consumption.remaining,
                latency_ms: latencyMs,
                session_expires_at: new Date(session.expires_at).toISOString(),
            },
        },
        {
            status: 200,
            headers: {
                ...corsHeaders(),
                'X-Sandbox-Remaining': String(consumption.remaining),
                'X-Sandbox-Latency-Ms': String(latencyMs),
                'Cache-Control': 'no-store',
            },
        }
    );
}
