// api/_lib/api-auth.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const TIER_LIMITS: Record<string, number> = {
    free: 100,
    standard: 1500,
    enterprise: 20000
};

export async function validateApiKey(req: Request) {
    const apiKey = req.headers.get('X-API-Key');
    if (!apiKey) return { valid: false as const, error: 'API key required', status: 401 };

    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: keyData, error } = await supabase.rpc('validate_api_key', {
        p_key_hash: hashHex
    });

    if (error || !keyData || keyData.length === 0) {
        return { valid: false as const, error: 'Invalid or deactivated API key', status: 403 };
    }

    const keyResult = keyData[0];
    const limit = TIER_LIMITS[keyResult.tier] || TIER_LIMITS.free;

    if (keyResult.requests_today > limit) {
        return { valid: false as const, error: `Daily quota of ${limit} requests exceeded. Upgrade your tier for higher limits.`, status: 429 };
    }

    return {
        valid: true as const,
        keyId: keyResult.id as string,
        tier: keyResult.tier as string,
        remaining: limit - keyResult.requests_today
    };
}

export async function logApiUsage(keyId: string, endpoint: string, method: string, status: number, startTime: number, req: Request) {
    const duration = Date.now() - startTime;
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    await supabase.from('api_usage_log').insert({
        api_key_id: keyId,
        endpoint,
        method,
        response_status: status,
        response_time_ms: duration,
        ip_address: ip
    });
}

export function corsHeaders(): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
        'Content-Type': 'application/json'
    };
}

export function errorResponse(message: string, status: number) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: corsHeaders()
    });
}
