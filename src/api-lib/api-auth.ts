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
        weight_multiplier: 5.0, // Punitive cost for anonymous
        allowed_filters: [], // No filtering allowed for guests
        features: ['basic_json']
    },
    jamii: { 
        monthly: 5000, 
        burst: 2, 
        weight_multiplier: 1.5,
        allowed_filters: ['county'], 
        features: ['basic_json', 'search']
    },
    mwananchi: { 
        monthly: 100000, 
        burst: 10, 
        weight_multiplier: 1.2,
        allowed_filters: ['county', 'constituency'], 
        features: ['basic_json', 'search', 'csv_export']
    },
    taifa: { 
        monthly: 500000, 
        burst: 30, 
        weight_multiplier: 1.0,
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
        weight_multiplier: 0.9,
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

// ---- Safe Crypto Helper ----
async function getSafeCrypto(): Promise<any> {
    try {
        const cryptoObj = (globalThis as any).crypto || (globalThis as any).msCrypto;
        if (cryptoObj && cryptoObj.subtle) return cryptoObj;
        
        // Final fallback for some edge runtimes
        if (typeof crypto !== 'undefined' && (crypto as any).subtle) return crypto;
    } catch { }
    
    // We do NOT import node:crypto here because it crashes Edge bundlers like Vercel's.
    return (globalThis as any).crypto;
}

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
// ---- Pricing & Knob Helpers ----
let configCache: { data: any, expiry: number } | null = null;

async function fetchConfigKnobs(env?: any): Promise<any> {
    const now = Date.now();
    if (configCache && configCache.expiry > now) return configCache.data;

    const SUPABASE_URL = getEnv('SUPABASE_URL', env);
    const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY', env);
    if (!SUPABASE_URL || !SUPABASE_KEY) return null;

    try {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/nasaka_config?select=key,value`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (!resp.ok) return null;
        const rows = await resp.json();
        const config = (rows as any[]).reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
        
        configCache = { data: config, expiry: now + 60000 }; // 1 min TTL
        return config;
    } catch {
        return null;
    }
}

export function calculateRequestWeight(req: Request, tier: string, knobs?: any): number {
    const url = new URL(req.url);
    const pathname = url.pathname;
    const format = url.searchParams.get('format');
    const metadata = TIER_LIMITS[tier] || TIER_LIMITS.public;

    // Default multipliers (Admin Knobs will override these)
    const m = knobs?.pricing_multipliers || {
        peak_surge: 1.5,
        boundary_multiplier: 10.0,
        stats_multiplier: 3.0,
        complex_query_penalty: 1.25,
        csv_multiplier: 5.0,
        geojson_multiplier: 8.0,
        locate_multiplier: 2.0
    };

    let weight = 1.0;

    // 1. Data Intensity Weight
    if (pathname.includes('/boundary')) weight = m.boundary_multiplier;
    if (pathname.includes('/stats')) weight = m.stats_multiplier;
    if (pathname.includes('/locate')) weight = m.locate_multiplier;
    if (format === 'csv') weight = m.csv_multiplier;
    if (format === 'geojson') weight = m.geojson_multiplier;

    // 2. Peak Hour Surge
    const peak = knobs?.peak_window || { start_hour_eat: 10, end_hour_eat: 16, is_enabled: true };
    if (peak.is_enabled) {
        try {
            const now = new Date();
            const hour = (now.getUTCHours() + 3) % 24; // UTC+3
            if (hour >= peak.start_hour_eat && hour <= peak.end_hour_eat) {
                weight *= m.peak_surge;
            }
        } catch { }
    }

    // 3. Admin Knobs: Search complexity weight
    const filters = Array.from(url.searchParams.keys()).filter(k => k !== 'limit' && k !== 'offset' && k !== 'route' && k !== 'X-API-Key');
    if (filters.length > 2) weight *= m.complex_query_penalty;

    // 4. Tier Multiplier
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
                error: 'Global anonymous rate limit exceeded. Get an X-API-Key at https://nasakaiebc.civiceducationkenya.com/pricing',
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

    // ─── Fast-Path: Internal Shared Secret ───────────────────────────────────
    // Allows the app to use its own internal key without requiring a DB lookup.
    const internalKey = getEnv('OFFICE_DATA_API_KEY', env) || getEnv('ADMIN_SECRET', env);
    if (apiKey === internalKey && internalKey && internalKey !== 'asdf1234') {
        return {
            valid: true as const,
            keyId: 'nasaka_internal_sync',
            tier: 'serikali', // Full feature access for internal calls
            remaining: 999999,
            creditsBalance: 999999
        };
    }

    // SHA-256 hash of the raw key
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    
    // Polyfill crypto for environments where it is not global (Standard Web API only)
    const cryptoObj = await getSafeCrypto();

    if (!cryptoObj || !cryptoObj.subtle) {
        return { valid: false as const, error: 'Cryptographic runtime missing. Deploy to Edge or Node.js 18+.', status: 500 };
    }

    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const SUPABASE_URL = getEnv('SUPABASE_URL', env);
    const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY', env);

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return { valid: false as const, error: 'Server misconfiguration', status: 500 };
    }

    const knobs = await fetchConfigKnobs(env);
    const weight = calculateRequestWeight(req, 'public', knobs); 

    // Resolve UUID from key hash to maintain atomic billing
    const keyLookup = await fetch(`${SUPABASE_URL}/rest/v1/api_keys?key_hash=eq.${hashHex}&select=id,tier,is_locked,plan_status,monthly_request_count,credits_balance,current_period_end`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });

    if (!keyLookup.ok) {
        return { valid: false as const, error: 'Invalid or deactivated API key', status: 403 };
    }

    const keys: any[] = await keyLookup.json();
    if (!keys || keys.length === 0) {
        return { valid: false as const, error: 'Invalid or deactivated API key', status: 403 };
    }

    const k = keys[0];

    // Step 3: Check locked & status
    if (k.is_locked) return { valid: false as const, error: 'Account locked.', status: 423 };
    if (k.plan_status === 'past_due') return { valid: false as const, error: 'Payment past due.', status: 402 };

    // Step 4: Feature gating check BEFORE charging
    const featureCheck = checkFeatureAccess(k.tier, req);
    if (!featureCheck.allowed) {
        return { valid: false as const, error: featureCheck.message!, status: 403 };
    }

    // Step 5: Atomic Charge
    const chargeWeight = calculateRequestWeight(req, k.tier, knobs);
    const chargeResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/charge_usage`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_key_id: k.id, p_endpoint_weight: Math.ceil(chargeWeight) })
    });

    if (!chargeResp.ok) {
        return { valid: false as const, error: 'Billing synchronization failed', status: 500 };
    }

    const chargeResult = await chargeResp.json();
    const charge = chargeResult?.[0];

    if (!charge?.allowed) {
        return { 
            valid: false as const, 
            error: charge?.reason || 'Quota exceeded', 
            status: charge?.limit_type === 'credits' ? 402 : 429 
        };
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
        remaining: charge.remaining,
        creditsBalance: k.credits_balance - Math.ceil(chargeWeight)
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
    const cryptoObj = await getSafeCrypto();
    
    if (!cryptoObj || !cryptoObj.subtle) {
        // Fallback to simple hash if crypto missing for logging
        const ipHash = ip.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0).toString(16);
        return { ipHash };
    }

    const ipHashBuffer = await cryptoObj.subtle.digest('SHA-256', ipData);
    const ipHashArray = Array.from(new Uint8Array(ipHashBuffer));
    const ipHash = ipHashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

    // Determine request weight via the Peak Pricing Engine
    const knobs = await fetchConfigKnobs(env);
    let requestWeight = weightOverride || calculateRequestWeight(req, tier, knobs);

    // Full Parameter Logging (Hashed for Privacy where needed, clear for audit)
    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    
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
            request_weight: requestWeight,
            search_params: JSON.stringify(searchParams) // Exhaustive parameter logging
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
