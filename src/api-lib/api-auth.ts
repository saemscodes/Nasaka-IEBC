// api/_lib/api-auth.ts
// Nasaka IEBC B2B API — Authentication, Rate Limiting, Feature Gating
// Uses Upstash Redis for burst rate limiting; Supabase for quota tracking.

// ---- Tier Definitions & Feature Gates ----
export interface TierMetadata {
    monthly: number;
    burst: number;
    weight_multiplier: number;
    allowed_filters: string[];
    features: string[];
}

export const TIER_LIMITS: Record<string, TierMetadata> = {
    public: { 
        monthly: 0, 
        burst: 1, 
        weight_multiplier: 2.0, // High cost for anonymous
        allowed_filters: [], // No filtering allowed for guests
        features: ['basic_json']
    },
    jamii: { 
        monthly: 5000, 
        burst: 2, 
        weight_multiplier: 1.2,
        allowed_filters: ['county'], 
        features: ['basic_json', 'search']
    },
    mwananchi: { 
        monthly: 100000, 
        burst: 10, 
        weight_multiplier: 1.0,
        allowed_filters: ['county', 'constituency'], 
        features: ['basic_json', 'search', 'csv_export']
    },
    taifa: { 
        monthly: 500000, 
        burst: 30, 
        weight_multiplier: 0.9,
        allowed_filters: ['county', 'constituency', 'ward'], 
        features: ['basic_json', 'search', 'csv_export', 'geojson_export', 'priority_support']
    },
    serikali: { 
        monthly: 10000000, 
        burst: 100, 
        weight_multiplier: 0.8,
        allowed_filters: ['all'], 
        features: ['all']
    },
    enterprise: { 
        monthly: 500000, 
        burst: 30, 
        weight_multiplier: 1.0,
        allowed_filters: ['all'], 
        features: ['all']
    }
};

// Endpoints restricted from Jamii tier
const GATED_ENDPOINTS = ['/api/v1/boundary', '/api/v1/enterprise'];
const GATED_FORMATS = ['csv', 'geojson'];

// ---- Universal Environment Helper ----
const getEnv = (name: string, env?: any) => {
    const val = env?.[name] || env?.[`VITE_${name}`];
    if (val) return val;
    try {
        if (typeof process !== 'undefined' && process.env) {
            return process.env[name] || process.env[`VITE_${name}`];
        }
    } catch { }
    return undefined;
};

// ---- Upstash Redis Rate Limiter ----
async function checkBurstRate(keyId: string, tier: string, env_context?: any): Promise<{ allowed: boolean; retryAfter?: number }> {
    const UPSTASH_URL = getEnv('UPSTASH_REDIS_REST_URL', env_context);
    const UPSTASH_TOKEN = getEnv('UPSTASH_REDIS_REST_TOKEN', env_context);

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

// ---- Dynamic Pricing & Credit Logic ----
export function calculateRequestWeight(req: Request, tier: string): number {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const format = url.searchParams.get('format');
    const metadata = TIER_LIMITS[tier] || TIER_LIMITS.public;

    let weight = 1.0;

    // 1. Data Intensity Weight
    if (pathname.includes('/boundary')) weight = 5.0;
    if (pathname.includes('/stats')) weight = 2.0;
    if (format === 'csv') weight = 3.0;
    if (format === 'geojson') weight = 5.0;

    // 2. Peak Hour Surge (Strict Mode)
    // Surge 1.5x during 10 AM - 4 PM EAT (Election Window)
    try {
        const now = new Date();
        const hour = now.getUTCHours() + 3; // Normalize to EAT (UTC+3)
        if (hour >= 10 && hour <= 16) {
            weight *= 1.5;
        }
    } catch { /* ignore if date fails */ }

    // 3. Tier Multiplier (Rewarding higher tiers with lower per-request costs)
    weight *= metadata.weight_multiplier;

    return Math.round(weight * 100) / 100;
}

// ---- Feature Gating (Strict Mode) ----
function checkFeatureAccess(tier: string, req: Request): { allowed: boolean; message?: string } {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const format = url.searchParams.get('format');
    const metadata = TIER_LIMITS[tier] || TIER_LIMITS.public;

    // 1. Check Gated Endpoints
    for (const ep of GATED_ENDPOINTS) {
        if (pathname.startsWith(ep) && !metadata.features.includes('all') && !metadata.features.includes('enterprise')) {
            return { allowed: false, message: `Access to ${ep} requires a professional tier.` };
        }
    }

    // 2. Check Gated Formats
    if (format && GATED_FORMATS.includes(format.toLowerCase())) {
        if (!metadata.features.includes(`${format.toLowerCase()}_export`) && !metadata.features.includes('all')) {
            return { allowed: false, message: `Export format '${format}' requires Taifa tier or above.` };
        }
    }

    // 3. Check Granular Filtering (Strict Mode)
    const filters = Array.from(url.searchParams.keys()).filter(k => k !== 'limit' && k !== 'offset' && k !== 'route' && k !== 'X-API-Key');
    if (filters.length > 0 && !metadata.allowed_filters.includes('all')) {
        for (const f of filters) {
            if (!metadata.allowed_filters.includes(f)) {
                return { 
                    allowed: false, 
                    message: `Filtering by '${f}' is restricted on the ${tier} tier. Upgrade for granular data access.` 
                };
            }
        }
    }

    return { allowed: true };
}

// ---- Main Validation Function ----
export async function validateApiKey(req: Request, options: { required?: boolean; env?: any } = { required: true }) {
    const env = options.env;
    // 0. Maintenance Mode Check (Global)
    try {
        if (getEnv('MAINTENANCE_MODE', env) === 'true') {
            return { valid: false as const, error: 'System is under planned maintenance. Please try again soon.', status: 503 };
        }
    } catch { /* fail open */ }

    const apiKey = req.headers.get('X-API-Key');
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'guest';
    const isPublic = !apiKey;

    if (isPublic && options.required) {
        return { valid: false as const, error: 'API key required. Get one at https://nasakaiebc.civiceducationkenya.com/pricing', status: 401 };
    }

    if (isPublic) {
        // Apply strict IP-based rate limiting for guest access
        const burstCheck = await checkBurstRate(ip.split(',')[0].trim(), 'public', env);
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
    
    // Polyfill crypto for environments where it is not global (Legacy Node.js)
    const cryptoObj = typeof crypto !== 'undefined' ? crypto : (await import('crypto')).webcrypto;
    const hashBuffer = await (cryptoObj as any).subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const SUPABASE_URL = getEnv('SUPABASE_URL', env);
    const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY', env);

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


    // Step 8: Monthly quota check
    const metadata = TIER_LIMITS[k.tier] || TIER_LIMITS.public;
    const monthlyLimit = metadata.monthly;
    if (k.monthly_request_count > monthlyLimit && metadata.monthly > 0) {
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
    const UPSTASH_URL = getEnv('UPSTASH_REDIS_REST_URL', env);
    const UPSTASH_TOKEN = getEnv('UPSTASH_REDIS_REST_TOKEN', env);
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

    // Burst rate check via Upstash Redis
    const burstCheck = await checkBurstRate(k.id, k.tier, env);
    if (!burstCheck.allowed) {
        return {
            valid: false as const,
            error: `Rate limit exceeded. Max ${TIER_LIMITS[k.tier]?.burst || 2} req/s for ${k.tier} tier.`,
            retryAfter: burstCheck.retryAfter,
            status: 429
        };
    }
    return {
        valid: true as const,
        keyId: k.id as string,
        tier: k.tier as string,
        remaining: monthlyLimit - k.monthly_request_count,
        creditsBalance: k.credits_balance as number
    };
}

// ---- Credit Deduction (fire-and-forget) ----
export async function deductCredits(keyId: string, weight: number = 1, env?: any) {
    const SUPABASE_URL = getEnv('SUPABASE_URL', env);
    const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY', env);
    if (!SUPABASE_URL || !SUPABASE_KEY || weight <= 0) return;

    // Call RPC to atomically decrement credits_balance
    fetch(`${SUPABASE_URL}/rest/v1/rpc/deduct_credits`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_key_id: keyId, p_amount: weight })
    }).catch(() => { }); // fire-and-forget
}

// ---- Usage Logging (fire-and-forget) ----
export async function logApiUsage(keyId: string, tier: string, endpoint: string, method: string, status: number, startTime: number, req: Request, env?: any, weightOverride?: number) {
    const SUPABASE_URL = getEnv('SUPABASE_URL', env);
    const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY', env);
    if (!SUPABASE_URL || !SUPABASE_KEY) return;

    const duration = Date.now() - startTime;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Hash IP for privacy
    const encoder = new TextEncoder();
    const ipData = encoder.encode(ip);
    const ipHashBuffer = await crypto.subtle.digest('SHA-256', ipData);
    const ipHashArray = Array.from(new Uint8Array(ipHashBuffer));
    const ipHash = ipHashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

    // Determine request weight via the Peak Pricing Engine
    let requestWeight = weightOverride || calculateRequestWeight(req, tier);

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
