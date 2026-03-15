export const config = { runtime: 'edge' };

// Nasaka IEBC — Enterprise (Serikali) Lead Enquiry
// Public endpoint for enterprise clients to submit interest.
// Rate-limited to 3 submissions per IP per hour via Upstash Redis.

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

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return Response.json({ error: 'Server misconfiguration' }, { status: 500, headers });
    }

    // ---- IP-based Rate Limiting (3/hour) ----
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
    const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (UPSTASH_URL && UPSTASH_TOKEN) {
        // Hash IP for the key
        const encoder = new TextEncoder();
        const ipHash = Array.from(new Uint8Array(
            await crypto.subtle.digest('SHA-256', encoder.encode(clientIp))
        )).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

        const rateLimitKey = `nasaka:enquiry:${ipHash}`;

        try {
            const pipelineResp = await fetch(`${UPSTASH_URL}/pipeline`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${UPSTASH_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify([
                    ['INCR', rateLimitKey],
                    ['EXPIRE', rateLimitKey, '3600'] // 1 hour window
                ])
            });

            if (pipelineResp.ok) {
                const results: any[] = await pipelineResp.json();
                const count = results[0]?.result || 0;
                if (count > 3) {
                    return Response.json({
                        error: 'Too many enquiry submissions. Please try again later.',
                    }, { status: 429, headers: { ...headers, 'Retry-After': '3600' } });
                }
            }
        } catch {
            // fail open
        }
    }

    // ---- Parse Body ----
    let body: any;
    try {
        body = await req.json();
    } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers });
    }

    const {
        organisation_name,
        contact_name,
        contact_email,
        contact_phone,
        organisation_type,
        use_case,
        estimated_monthly_requests,
        preferred_currency
    } = body;

    if (!organisation_name || !contact_name || !contact_email || !use_case) {
        return Response.json({
            error: 'Missing required fields: organisation_name, contact_name, contact_email, use_case'
        }, { status: 400, headers });
    }

    // ---- Validate organisation_type ----
    const validTypes = ['county_government', 'ngo', 'development_agency', 'media_house', 'research_institution', 'election_observer', 'other'];
    if (organisation_type && !validTypes.includes(organisation_type)) {
        return Response.json({
            error: `Invalid organisation_type. Valid values: ${validTypes.join(', ')}`
        }, { status: 400, headers });
    }

    // ---- Insert Lead ----
    try {
        const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/nasaka_enterprise_leads`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                organisation_name,
                contact_name,
                contact_email,
                contact_phone: contact_phone || null,
                organisation_type: organisation_type || 'other',
                use_case,
                estimated_monthly_requests: estimated_monthly_requests || null,
                preferred_currency: preferred_currency || 'KES',
                status: 'new'
            })
        });

        if (!insertResp.ok) {
            const errText = await insertResp.text();
            return Response.json({ error: `Failed to submit enquiry: ${errText}` }, { status: 502, headers });
        }

        const inserted = await insertResp.json();

        // ---- Notify Admin (fire-and-forget) ----
        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
        if (adminEmail) {
            // Log for admin notification — actual email sending would require
            // an email service integration (e.g., Resend, SendGrid)
            console.log(`[Enterprise Lead] New enquiry from ${contact_name} at ${organisation_name} (${contact_email})`);
        }

        return Response.json({
            message: 'Enquiry submitted successfully. Our team will contact you within 48 hours.',
            data: {
                id: inserted[0]?.id,
                organisation: organisation_name,
                status: 'new'
            }
        }, { status: 201, headers });

    } catch (err: any) {
        return Response.json({ error: err.message || 'Internal server error' }, { status: 500, headers });
    }
}
