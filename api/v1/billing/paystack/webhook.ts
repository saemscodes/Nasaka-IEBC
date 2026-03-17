export const config = { runtime: 'edge' };

// Nasaka IEBC — Paystack Webhook Handler
// Processes: subscription.create, charge.success, subscription.disable,
// invoice.payment_failed, invoice.update
// Idempotent: checks nasaka_paystack_events before processing.
// Signature-verified: HMAC SHA-512 against PAYSTACK_SECRET_KEY.

export default async function handler(req: Request): Promise<Response> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache'
    };

    if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
    }

    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!PAYSTACK_SECRET || !SUPABASE_URL || !SUPABASE_KEY) {
        return Response.json({ error: 'Server misconfiguration' }, { status: 500, headers });
    }

    // ---- Signature Verification ----
    const signature = req.headers.get('x-paystack-signature');
    const rawBody = await req.text();

    if (!signature) {
        return Response.json({ error: 'Missing signature' }, { status: 401, headers });
    }

    // HMAC SHA-512 verification
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(PAYSTACK_SECRET),
        { name: 'HMAC', hash: 'SHA-512' },
        false,
        ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    if (computedSignature !== signature) {
        return Response.json({ error: 'Invalid signature' }, { status: 401, headers });
    }

    let event: any;
    try {
        event = JSON.parse(rawBody);
    } catch {
        return Response.json({ error: 'Invalid JSON' }, { status: 400, headers });
    }

    const eventId = String(event.data?.id || event.data?.reference || Date.now());
    const eventType = event.event;

    // ---- Idempotency Check ----
    const dupeCheckResp = await fetch(
        `${SUPABASE_URL}/rest/v1/nasaka_paystack_events?paystack_event_id=eq.${encodeURIComponent(eventId)}&select=id`,
        {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );

    if (dupeCheckResp.ok) {
        const existing = await dupeCheckResp.json();
        if (existing.length > 0) {
            // Already processed — return 200 (Paystack expects 200)
            return Response.json({ message: 'Event already processed' }, { status: 200, headers });
        }
    }

    const supaHeaders = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    };

    // ---- Process Event ----
    try {
        const data = event.data;
        const metadata = data.metadata || {};
        const apiKeyId = metadata.api_key_id;

        switch (eventType) {
            case 'subscription.create': {
                if (apiKeyId) {
                    const tier = metadata.product_key?.startsWith('taifa') ? 'taifa' : 'mwananchi';
                    const billingInterval = metadata.product_key?.includes('annual') ? 'annual' : 'monthly';
                    const periodEnd = new Date();
                    periodEnd.setMonth(periodEnd.getMonth() + (billingInterval === 'annual' ? 12 : 1));

                    await fetch(`${SUPABASE_URL}/rest/v1/api_keys?id=eq.${apiKeyId}`, {
                        method: 'PATCH',
                        headers: supaHeaders,
                        body: JSON.stringify({
                            tier,
                            plan_status: 'active',
                            billing_interval: billingInterval,
                            paystack_subscription_code: data.subscription_code || data.reference,
                            paystack_customer_code: data.customer?.customer_code || null,
                            current_period_start: new Date().toISOString(),
                            current_period_end: periodEnd.toISOString(),
                            is_locked: false
                        })
                    });
                }
                break;
            }

            case 'charge.success': {
                const paymentType = metadata.payment_type;
                const reference = data.reference;
                const channel = data.channel || 'card';
                const amount = data.amount || 0;

                // Log payment
                await fetch(`${SUPABASE_URL}/rest/v1/nasaka_payment_history`, {
                    method: 'POST',
                    headers: supaHeaders,
                    body: JSON.stringify({
                        api_key_id: apiKeyId || null,
                        paystack_reference: reference,
                        channel: channel === 'dedicated_nuban' ? 'bank_transfer' : (channel === 'mobile_money' ? 'mobile_money' : 'card'),
                        amount_kobo: amount,
                        currency: data.currency || 'KES',
                        tier_purchased: metadata.product_key || 'unknown',
                        billing_interval: paymentType || 'one_time',
                        status: 'success',
                        paid_at: data.paid_at || new Date().toISOString()
                    })
                });

                // Handle credit pack purchases
                if (paymentType === 'credit_pack' && apiKeyId && metadata.credits_amount) {
                    // Fetch current credits, then add
                    const currentResp = await fetch(
                        `${SUPABASE_URL}/rest/v1/api_keys?id=eq.${apiKeyId}&select=credits_balance`,
                        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' } }
                    );
                    if (currentResp.ok) {
                        const current = await currentResp.json();
                        const currentCredits = current[0]?.credits_balance || 0;
                        await fetch(`${SUPABASE_URL}/rest/v1/api_keys?id=eq.${apiKeyId}`, {
                            method: 'PATCH',
                            headers: supaHeaders,
                            body: JSON.stringify({
                                credits_balance: currentCredits + metadata.credits_amount
                            })
                        });
                    }
                }

                // Handle subscription renewal (extend period)
                if (paymentType === 'subscription' && apiKeyId) {
                    const currentResp = await fetch(
                        `${SUPABASE_URL}/rest/v1/api_keys?id=eq.${apiKeyId}&select=current_period_end,billing_interval`,
                        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' } }
                    );
                    if (currentResp.ok) {
                        const current = await currentResp.json();
                        const interval = current[0]?.billing_interval || 'monthly';
                        const newEnd = new Date();
                        newEnd.setMonth(newEnd.getMonth() + (interval === 'annual' ? 12 : 1));
                        await fetch(`${SUPABASE_URL}/rest/v1/api_keys?id=eq.${apiKeyId}`, {
                            method: 'PATCH',
                            headers: supaHeaders,
                            body: JSON.stringify({
                                current_period_end: newEnd.toISOString(),
                                plan_status: 'active',
                                is_locked: false,
                                renewal_reminder_sent_at: null
                            })
                        });
                    }
                }
                break;
            }

            case 'subscription.disable': {
                if (apiKeyId) {
                    await fetch(`${SUPABASE_URL}/rest/v1/api_keys?id=eq.${apiKeyId}`, {
                        method: 'PATCH',
                        headers: supaHeaders,
                        body: JSON.stringify({ plan_status: 'non_renewing' })
                    });
                }
                break;
            }

            case 'invoice.payment_failed': {
                if (apiKeyId) {
                    await fetch(`${SUPABASE_URL}/rest/v1/api_keys?id=eq.${apiKeyId}`, {
                        method: 'PATCH',
                        headers: supaHeaders,
                        body: JSON.stringify({ plan_status: 'past_due' })
                    });
                }
                break;
            }

            case 'invoice.update': {
                if (apiKeyId && data.paid_at) {
                    const newEnd = new Date(data.paid_at);
                    newEnd.setMonth(newEnd.getMonth() + 1);
                    await fetch(`${SUPABASE_URL}/rest/v1/api_keys?id=eq.${apiKeyId}`, {
                        method: 'PATCH',
                        headers: supaHeaders,
                        body: JSON.stringify({ current_period_end: newEnd.toISOString() })
                    });
                }
                break;
            }
        }

        // ---- Log Event for Idempotency ----
        await fetch(`${SUPABASE_URL}/rest/v1/nasaka_paystack_events`, {
            method: 'POST',
            headers: supaHeaders,
            body: JSON.stringify({
                paystack_event_id: eventId,
                event_type: eventType,
                api_key_id: apiKeyId || null,
                raw_payload: event
            })
        });

        // ---- Keystone: Cache Tier in Redis for Edge Enforcement ----
        // If we updated a key, we MUST update the Redis cache so Middleware sees it instantly.
        if (apiKeyId && ['subscription.create', 'charge.success', 'invoice.update'].includes(eventType)) {
            try {
                // Fetch the full context from Supabase to ensure Redis is 100% accurate
                const finalResp = await fetch(
                    `${SUPABASE_URL}/rest/v1/api_keys?id=eq.${apiKeyId}&select=tier,key_hash,is_locked,plan_status`,
                    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' } }
                );
                if (finalResp.ok) {
                    const finalData = await finalResp.json();
                    if (finalData.length > 0) {
                        const { tier, key_hash, is_locked, plan_status } = finalData[0];
                        const { Redis } = await import('@upstash/redis');
                        const redis = Redis.fromEnv();

                        // Cache the tier mapping for 35 days (covering monthly renewal cycles)
                        await redis.set(`tier:${key_hash}`, {
                            tier,
                            locked: is_locked,
                            status: plan_status,
                            updated_at: new Date().toISOString()
                        }, { ex: 60 * 60 * 24 * 35 });

                        console.log(`[Webhook] Cached tier ${tier} for key ${apiKeyId} in Redis`);
                    }
                }
            } catch (redisErr: any) {
                console.error('[Redis Cache Error]', redisErr.message);
            }
        }

    } catch (err: any) {
        // Log error but still return 200 to prevent Paystack retries
        console.error('[Paystack Webhook Error]', err.message);
    }

    // Always return 200 to Paystack
    return Response.json({ message: 'Webhook received' }, { status: 200, headers });
}
