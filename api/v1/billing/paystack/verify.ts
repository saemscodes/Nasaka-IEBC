export const config = { runtime: 'nodejs' };

// Nasaka IEBC — Paystack Transaction Verification
// Called by frontend after Paystack redirect to confirm payment server-side.
// Never trusts frontend — always verifies with Paystack API.

export default async function handler(req: Request): Promise<Response> {
    const headers: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'X-API-Key, Content-Type',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { headers });
    }

    if (req.method !== 'GET') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
    }

    const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET) {
        return Response.json({ error: 'Payment gateway not configured' }, { status: 500, headers });
    }

    const url = new URL(req.url);
    const reference = url.searchParams.get('reference');

    if (!reference) {
        return Response.json({ error: 'Missing reference query parameter' }, { status: 400, headers });
    }

    try {
        const verifyResp = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET}`
            }
        });

        const verifyData = await verifyResp.json();

        if (!verifyData.status || verifyData.data?.status !== 'success') {
            return Response.json({
                verified: false,
                status: verifyData.data?.status || 'failed',
                message: verifyData.data?.gateway_response || 'Payment not confirmed'
            }, { status: 200, headers });
        }

        const txData = verifyData.data;

        return Response.json({
            verified: true,
            status: 'success',
            data: {
                reference: txData.reference,
                amount_kes: txData.amount / 100,
                currency: txData.currency,
                channel: txData.channel,
                paid_at: txData.paid_at,
                product: txData.metadata?.product_key || 'unknown',
                customer_email: txData.customer?.email
            }
        }, { status: 200, headers });

    } catch (err: any) {
        return Response.json({ error: err.message || 'Verification failed' }, { status: 500, headers });
    }
}
