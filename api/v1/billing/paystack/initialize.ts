export const config = { runtime: 'nodejs' };

// Nasaka IEBC — Paystack Payment Initialization
// Handles subscription plans AND one-time charges (credit packs, data licenses).

const TIER_PRICES: Record<string, { amount: number; name: string }> = {
    mwananchi_monthly: { amount: 250000, name: 'Mwananchi Monthly' },     // KES 2,500 in kobo
    mwananchi_annual: { amount: 2500000, name: 'Mwananchi Annual' },     // KES 25,000
    taifa_monthly: { amount: 800000, name: 'Taifa Monthly' },         // KES 8,000
    taifa_annual: { amount: 8000000, name: 'Taifa Annual' },         // KES 80,000
    credit_50k: { amount: 350000, name: '50,000 Credits' },        // KES 3,500
    credit_200k: { amount: 1000000, name: '200,000 Credits' },      // KES 10,000
    credit_500k: { amount: 2000000, name: '500,000 Credits' },      // KES 20,000
    license_academic: { amount: 1500000, name: 'Data License (Academic)' }, // KES 15,000
    license_commercial: { amount: 4000000, name: 'Data License (Commercial)' }  // KES 40,000
};

const CREDIT_AMOUNTS: Record<string, number> = {
    credit_50k: 50000,
    credit_200k: 200000,
    credit_500k: 500000
};

const PLAN_CODE_ENV_MAP: Record<string, string> = {
    mwananchi_monthly: 'PAYSTACK_MWANANCHI_PLAN_CODE_MONTHLY',
    mwananchi_annual: 'PAYSTACK_MWANANCHI_PLAN_CODE_ANNUAL',
    taifa_monthly: 'PAYSTACK_TAIFA_PLAN_CODE_MONTHLY',
    taifa_annual: 'PAYSTACK_TAIFA_PLAN_CODE_ANNUAL'
};

export default async function handler(req: Request): Promise<Response> {
    const headers: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { headers });
    }

    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
    }

    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) {
        return Response.json({ error: 'Payment gateway not configured' }, { status: 500, headers });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers });
    }

    const { email, product_key, api_key_id, callback_url } = body;

    // ---- Session Verification ----
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
        return Response.json({ error: 'Authentication required' }, { status: 401, headers });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const SUPABASE_SR_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // 1. Verify user session via JWT
    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            'apikey': SUPABASE_KEY!,
            'Authorization': authHeader
        }
    });

    if (!userResp.ok) {
        return Response.json({ error: 'Invalid session' }, { status: 401, headers });
    }
    const userData = await userResp.json();
    const userId = userData.id;

    // 2. If api_key_id provided, verify ownership
    if (api_key_id) {
        const keyVerifyResp = await fetch(`${SUPABASE_URL}/rest/v1/api_keys?id=eq.${api_key_id}&user_id=eq.${userId}&select=id`, {
            headers: {
                'apikey': SUPABASE_SR_KEY!,
                'Authorization': `Bearer ${SUPABASE_SR_KEY}`
            }
        });
        const keyData = await keyVerifyResp.json();
        if (!keyData || keyData.length === 0) {
            return Response.json({ error: 'Invalid API key ownership' }, { status: 403, headers });
        }
    }

    if (!email || !product_key) {
        return Response.json({
            error: 'Missing required fields: email, product_key',
            valid_product_keys: Object.keys(TIER_PRICES)
        }, { status: 400, headers });
    }

    const priceInfo = TIER_PRICES[product_key];
    if (!priceInfo) {
        return Response.json({
            error: `Invalid product_key: ${product_key}`,
            valid_product_keys: Object.keys(TIER_PRICES)
        }, { status: 400, headers });
    }

    // Determine if this is a subscription or one-time charge
    const isSubscription = product_key in PLAN_CODE_ENV_MAP;
    const planCode = isSubscription ? process.env[PLAN_CODE_ENV_MAP[product_key]] : null;

    if (isSubscription && !planCode) {
        return Response.json({
            error: `Paystack plan not configured for ${product_key}. Set ${PLAN_CODE_ENV_MAP[product_key]} env var.`
        }, { status: 500, headers });
    }

    // Build Paystack transaction initialization payload
    const paystackBody: any = {
        email,
        amount: priceInfo.amount, // in kobo
        currency: 'KES',
        callback_url: callback_url || 'https://nasakaiebc.civiceducationkenya.com/dashboard/api-keys',
        metadata: {
            product_key,
            api_key_id: api_key_id || null,
            payment_type: isSubscription ? 'subscription' : (product_key.startsWith('credit_') ? 'credit_pack' : 'data_license'),
            custom_fields: [
                { display_name: 'Product', variable_name: 'product', value: priceInfo.name },
                { display_name: 'Platform', variable_name: 'platform', value: 'Nasaka IEBC API' }
            ]
        }
    };

    if (isSubscription && planCode) {
        paystackBody.plan = planCode;
    }

    // Credit pack amount metadata
    if (CREDIT_AMOUNTS[product_key]) {
        paystackBody.metadata.credits_amount = CREDIT_AMOUNTS[product_key];
    }

    try {
        const paystackResp = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paystackBody)
        });

        const paystackData = await paystackResp.json();

        if (!paystackData.status) {
            return Response.json({
                error: 'Payment initialization failed',
                details: paystackData.message
            }, { status: 502, headers });
        }

        return Response.json({
            data: {
                authorization_url: paystackData.data.authorization_url,
                access_code: paystackData.data.access_code,
                reference: paystackData.data.reference,
                product: priceInfo.name,
                amount_kes: priceInfo.amount / 100
            }
        }, { status: 200, headers });

    } catch (err: any) {
        return Response.json({ error: err.message || 'Payment gateway error' }, { status: 500, headers });
    }
}
