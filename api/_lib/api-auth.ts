// api/_lib/api-auth.ts
// Nasaka IEBC B2B API — Authentication, Rate Limiting, Feature Gating
// Uses Upstash Redis for burst rate limiting; Supabase for quota tracking.

// ---- Tier Definitions ----
export const TIER_LIMITS: Record<string, { monthly: number; burst: number }> = {
    jamii: { monthly: 5000, burst: 2 },
    mwananchi: { monthly: 100000, burst: 10 },
    taifa: { monthly: 500000, burst: 30 },
    serikali: { monthly: 10000000, burst: 100 },
    enterprise: { monthly: 500000, burst: 30 },
    // Global Public (Guest) tier — strictly for keyless requests
    public: { monthly: 0, burst: 1 } // 1 request per second max for anonymous
};

// Endpoints restricted from Jamii tier
const GATED_ENDPOINTS = ['/api/v1/boundary'];
const GATED_FORMATS = ['csv', 'geojson'];

// ---- Upstash Redis Rate Limiter ----
async function checkBurstRate(keyId: string, tier: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
        // If Redis not configured, allow through (graceful degradation)
        return { allowed: true };
    }

    const limit = TIER_LIMITS[tier]?.burst || 1;
    const windowKey = `nasaka:burst:${keyId}`;
    const windowSeconds = 1;

    try {
        // Atomic increment + expire via Upstash REST pipeline
        const pipelineResp = await fetch(`${UPSTASH_URL}/pipeline`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${UPSTASH_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify([
                ['INCR', windowKey],
                ['EXPIRE', windowKey, String(windowSeconds)]
            ])
        });

        if (!pipelineResp.ok) {
            return { allowed: true }; // fail open
        }

        const results: any[] = await pipelineResp.json();
        const currentCount = results[0]?.result || 0;

        if (currentCount > limit) {
            return { allowed: false, retryAfter: windowSeconds };
        }

        return { allowed: true };
    } catch {
        return { allowed: true }; // fail open on Redis errors
    }
}

// ---- Feature Gating ----
function checkFeatureAccess(tier: string, req: Request): { allowed: boolean; message?: string } {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const format = url.searchParams.get('format');

    // Jamii (free) tier restrictions
    if (tier === 'jamii' || tier === 'free') {
        // Block gated endpoints
        for (const ep of GATED_ENDPOINTS) {
            if (pathname.startsWith(ep)) {
                return {
                    allowed: false,
                    message: `This endpoint requires Mwananchi tier or above.`
                };
            }
        }

        // Block gated formats (csv, geojson)
        if (format && GATED_FORMATS.includes(format.toLowerCase())) {
            return {
                allowed: false,
                message: `Export format '${format}' requires Mwananchi tier or above.`
            };
        }
    }

    return { allowed: true };
}

// ---- Main Validation Function ----
export async function validateApiKey(req: Request, options: { required?: boolean } = { required: true }) {
    const apiKey = req.headers.get('X-API-Key');
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'guest';
    const isPublic = !apiKey;

    if (isPublic && options.required) {
        return { valid: false as const, error: 'API key required. Get one at https://nasakaiebc.civiceducationkenya.com/pricing', status: 401 };
    }

    if (isPublic) {
        // Apply strict IP-based rate limiting for guest access
        const burstCheck = await checkBurstRate(ip.split(',')[0].trim(), 'public');
        if (!burstCheck.allowed) {
            return {
                valid: false as const,
                error: 'Global rate limit exceeded. Provide an X-API-Key for higher quotas.',
                retryAfter: burstCheck.retryAfter,
                status: 429
            };
        }
        return {
            valid: true as const,
            keyId: 'public_guest',
            tier: 'public',
            remaining: 0,
            creditsBalance: 0
        };
    }

    // SHA-256 hash of the raw key
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return { valid: false as const, error: 'Server misconfiguration', status: 500 };
    }

    // Call the validate_api_key RPC via PostgREST
    const rpcResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/validate_api_key`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_key_hash: hashHex })
    });

    if (!rpcResp.ok) {
        return { valid: false as const, error: 'Invalid or deactivated API key', status: 403 };
    }

    const keyData: any[] = await rpcResp.json();
    if (!keyData || keyData.length === 0) {
        return { valid: false as const, error: 'Invalid or deactivated API key', status: 403 };
    }

    const k = keyData[0];

    // Step 3: Check locked
    if (k.is_locked) {
        return {
            valid: false as const,
            error: 'Account locked. Renew subscription to restore access.',
            status: 423
        };
    }

    // Step 4: Check past_due
    if (k.plan_status === 'past_due') {
        return {
            valid: false as const,
            error: 'Payment past due. Please renew your subscription.',
            status: 402
        };
    }

    // Step 5: Check subscription expiry for paid tiers
    if (k.tier !== 'jamii' && k.tier !== 'free' && k.current_period_end) {
        const periodEnd = new Date(k.current_period_end);
        const gracePeriod = new Date(periodEnd.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days grace
        if (new Date() > gracePeriod) {
            // Lock the key asynchronously
            fetch(`${SUPABASE_URL}/rest/v1/api_keys?id=eq.${k.id}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ is_locked: true, plan_status: 'cancelled' })
            }).catch(() => { }); // fire-and-forget

            return {
                valid: false as const,
                error: 'Subscription expired. Renew at https://nasakaiebc.civiceducationkenya.com/pricing',
                status: 402
            };
        }
    }

    // Step 6: Feature gating
    const featureCheck = checkFeatureAccess(k.tier, req);
    if (!featureCheck.allowed) {
        return {
            valid: false as const,
            error: featureCheck.message!,
            upgrade_url: 'https://nasakaiebc.civiceducationkenya.com/pricing',
            status: 403
        };
    }

    // Step 7: Burst rate check via Upstash Redis
    const burstCheck = await checkBurstRate(k.id, k.tier);
    if (!burstCheck.allowed) {
        return {
            valid: false as const,
            error: `Rate limit exceeded. Max ${TIER_LIMITS[k.tier]?.burst || 2} req/s for ${k.tier} tier.`,
            retryAfter: burstCheck.retryAfter,
            status: 429
        };
    }

    // Step 8: Monthly quota check
    const monthlyLimit = TIER_LIMITS[k.tier]?.monthly || 5000;
    if (k.monthly_request_count > monthlyLimit) {
        return {
            valid: false as const,
            error: `Monthly quota of ${monthlyLimit.toLocaleString()} requests exhausted. Upgrade at https://nasakaiebc.civiceducationkenya.com/pricing`,
            status: 429
        };
    }

    // Steps 9 & 10 are handled by the RPC (increment already happened)
    // Usage logging is fire-and-forget at the caller level

    // ---- Keystone: Populate Redis Cache for Edge Middleware ----
    // Do not await — fire and forget
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (UPSTASH_URL && UPSTASH_TOKEN) {
        fetch(`${UPSTASH_URL}/set/tier:${hashHex}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` },
            body: JSON.stringify({
                tier: k.tier,
                locked: k.is_locked,
                status: k.plan_status,
                updated_at: new Date().toISOString()
            })
        }).catch(() => { });
    }

    return {
        valid: true as const,
        keyId: k.id as string,
        tier: k.tier as string,
        remaining: monthlyLimit - k.monthly_request_count,
        creditsBalance: k.credits_balance as number
    };
}

// ---- Usage Logging (fire-and-forget) ----
export async function logApiUsage(keyId: string, endpoint: string, method: string, status: number, startTime: number, req: Request, weightOverride?: number) {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) return;

    const duration = Date.now() - startTime;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Hash IP for privacy
    const encoder = new TextEncoder();
    const ipData = encoder.encode(ip);
    const ipHashBuffer = await crypto.subtle.digest('SHA-256', ipData);
    const ipHashArray = Array.from(new Uint8Array(ipHashBuffer));
    const ipHash = ipHashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

    // Determine request weight
    let requestWeight = weightOverride || 1;
    if (!weightOverride) {
        const url = new URL(req.url);
        if (url.pathname.includes('/boundary')) requestWeight = 5;
        if (url.searchParams.get('format') === 'csv') requestWeight = 3;
    }

    // Fire-and-forget — do not await
    fetch(`${SUPABASE_URL}/rest/v1/nasaka_usage_log`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
            api_key_id: keyId,
            endpoint,
            response_code: status,
            ip_hash: ipHash,
            request_weight: requestWeight
        })
    }).catch(() => { }); // intentionally swallowed

    // Also write to legacy table for backward compat
    fetch(`${SUPABASE_URL}/rest/v1/api_usage_log`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
            api_key_id: keyId,
            endpoint,
            method,
            response_status: status,
            response_time_ms: duration,
            ip_address: ip
        })
    }).catch(() => { });
}

// ---- CORS Headers ----
export function corsHeaders(): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
        'Content-Type': 'application/json'
    };
}

// ---- Error Response ----
export function errorResponse(message: string, status: number, extra?: Record<string, any>) {
    const body: any = { error: message };
    if (extra) Object.assign(body, extra);

    const headers: Record<string, string> = corsHeaders();
    if (status === 429 && extra?.retryAfter) {
        headers['Retry-After'] = String(extra.retryAfter);
    }

    return new Response(JSON.stringify(body), { status, headers });
}
