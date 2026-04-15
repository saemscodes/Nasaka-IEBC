// api/v1/sandbox/init.ts
// Nasaka IEBC Sandbox — Session Initialization with Secure CEKA OAuth Exchange

import { CEKA_TOKEN_URL, CEKA_CLIENT_ID } from '../../../src/integrations/ceka/client';

export const config = { runtime: 'nodejs' };

// ─── Inline CORS Headers (Shared with request.ts) ────────────────────────────
export function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sandbox-key',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };
}

// ─── In-Memory Session Store ─────────────────────────────────────────────────
interface SandboxSession {
    key: string;
    email: string;
    name: string;
    ceka_user_id: string;
    requests_used: number;
    max_requests: number;
    created_at: number;
    expires_at: number;
    last_request_at: number;
}

const sessions = new Map<string, SandboxSession>();

function cleanupSessions() {
    const now = Date.now();
    for (const [key, session] of sessions) {
        if (now > session.expires_at) {
            sessions.delete(key);
        }
    }
}

export function getSession(key: string): SandboxSession | null {
    cleanupSessions();
    return sessions.get(key) || null;
}

export function consumeRequest(key: string): { allowed: boolean; remaining: number; retryAfter?: number } {
    const session = sessions.get(key);
    if (!session) return { allowed: false, remaining: 0 };

    const now = Date.now();
    if (now > session.expires_at) {
        sessions.delete(key);
        return { allowed: false, remaining: 0 };
    }

    if (session.requests_used >= session.max_requests) {
        return { allowed: false, remaining: 0 };
    }

    if (now - session.last_request_at < 1000) {
        return { allowed: false, remaining: session.max_requests - session.requests_used, retryAfter: 1 };
    }

    session.requests_used++;
    session.last_request_at = now;
    sessions.set(key, session);

    return { allowed: true, remaining: session.max_requests - session.requests_used };
}

function generateSandboxKey(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `nsk_sandbox_${hex}`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export default async function handler(req: Request, env: any): Promise<Response> {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders() });
    }

    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders() });
    }

    try {
        const body = await req.json();
        const { code, access_token } = body;

        if (!code && !access_token) {
            return Response.json({ error: 'Missing authorization code or access token' }, { status: 400, headers: corsHeaders() });
        }

        let email: string;
        let name: string;
        let cekaUserId: string;

        if (access_token) {
            // ── Path A: Verify CEKA JWT directly (inline password auth flow) ──
            const CEKA_SUPABASE_URL = 'https://cajrvemigxghnfmyopiy.supabase.co';
            const CEKA_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhanJ2ZW1pZ3hnaG5mbXlvcGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyOTU1OTAsImV4cCI6MjA1OTg3MTU5MH0.sgItW4OBC9i-eKnnUDxdMB6qgGdXyiKAD9c6C2u40As';
            const userResp = await fetch(`${CEKA_SUPABASE_URL}/auth/v1/user`, {
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'apikey': CEKA_SUPABASE_ANON_KEY,
                },
            });
            if (!userResp.ok) {
                return Response.json({ error: 'Invalid CEKA session token. Please sign in again.' }, { status: 401, headers: corsHeaders() });
            }
            const cekaUserData = await userResp.json();
            email = cekaUserData.email;
            name = cekaUserData.user_metadata?.full_name || cekaUserData.user_metadata?.name || email.split('@')[0];
            cekaUserId = cekaUserData.id;
        } else {
            // ── Path B: OAuth code exchange (legacy — kept for backward compat) ──
            const clientSecret = env?.CEKA_CLIENT_SECRET || process.env.CEKA_CLIENT_SECRET;
            if (!clientSecret) {
                console.error('[Sandbox-Init] CEKA_CLIENT_SECRET not configured');
                return Response.json({ error: 'Server configuration error' }, { status: 500, headers: corsHeaders() });
            }
            const exchangeResponse = await fetch(CEKA_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ grant_type: 'authorization_code', code, client_id: CEKA_CLIENT_ID, client_secret: clientSecret }),
            });
            if (!exchangeResponse.ok) {
                const errorData = await exchangeResponse.json();
                return Response.json({ error: 'OAuth exchange failed', details: errorData.message }, { status: 401, headers: corsHeaders() });
            }
            const authData = await exchangeResponse.json();
            email = authData.user.email;
            name = authData.user.name;
            cekaUserId = authData.user.id;
        }

        // 2. Rate limit: max 3 active sessions per email
        cleanupSessions();
        let activeForEmail = 0;
        for (const [, s] of sessions) {
            if (s.email === email) activeForEmail++;
        }
        if (activeForEmail >= 3) {
            return Response.json({ error: 'Maximum 3 concurrent sessions allowed.' }, { status: 429, headers: corsHeaders() });
        }

        const key = generateSandboxKey();
        const now = Date.now();
        const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

        const session: SandboxSession = {
            key,
            email,
            name,
            ceka_user_id: cekaUserId,
            requests_used: 0,
            max_requests: 50,
            created_at: now,
            expires_at: now + TTL_MS,
            last_request_at: 0,
        };

        sessions.set(key, session);

        return Response.json({
            success: true,
            sandbox_key: key,
            user: { name, email },
            requests_remaining: 50,
            expires_at: new Date(session.expires_at).toISOString(),
            ttl_seconds: TTL_MS / 1000,
            endpoints: ['health', 'offices', 'counties', 'locate', 'stats'],
        }, {
            status: 201,
            headers: corsHeaders(),
        });
    } catch (err: any) {
        return Response.json(
            { error: err.message || 'Failed to initialize sandbox session' },
            { status: 500, headers: corsHeaders() }
        );
    }
}

export { sessions };
