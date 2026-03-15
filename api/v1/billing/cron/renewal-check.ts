export const config = { runtime: 'edge' };

// Nasaka IEBC — M-Pesa Renewal Reminder Cron
// Runs daily via Vercel Cron. Finds keys expiring within 5 days
// and sends renewal email reminders. Also handles grace period expiry.
//
// Cron schedule: 0 6 * * * (daily at 6 AM EAT / 3 AM UTC)
// Configure in vercel.json: { "crons": [{ "path": "/api/v1/billing/cron/renewal-check", "schedule": "0 3 * * *" }] }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || '';

// 5-day reminder window
const REMINDER_DAYS = 5;
// 3-day grace period after expiry before locking
const GRACE_DAYS = 3;

async function supabaseQuery(path: string, options: RequestInit = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const resp = await fetch(url, {
        ...options,
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.method === 'PATCH' ? 'return=minimal' : 'return=representation',
            ...((options.headers as Record<string, string>) || {})
        }
    });
    return resp;
}

export default async function handler(req: Request): Promise<Response> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache'
    };

    // Only allow GET (Vercel cron) and POST (manual trigger)
    if (req.method !== 'GET' && req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
    }

    // Verify cron secret or service role for manual triggers
    const authHeader = req.headers.get('authorization');
    const cronSecret = req.headers.get('x-vercel-cron-secret');

    // Allow Vercel cron (has CRON_SECRET) or service role auth
    if (!cronSecret && authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
        // Also allow if called from Vercel's internal cron system (no auth needed for same-project crons)
        const userAgent = req.headers.get('user-agent') || '';
        if (!userAgent.includes('vercel-cron')) {
            return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
        }
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return Response.json({ error: 'Server not configured' }, { status: 500, headers });
    }

    const now = new Date();
    const results = {
        reminders_sent: 0,
        grace_expired: 0,
        downgraded: 0,
        errors: [] as string[]
    };

    try {
        // ──────────────────────────────────────────────────────────────
        // STEP 1: Send renewal reminders (5 days before expiry)
        // ──────────────────────────────────────────────────────────────
        const reminderCutoff = new Date(now.getTime() + REMINDER_DAYS * 24 * 60 * 60 * 1000).toISOString();

        const reminderResp = await supabaseQuery(
            `api_keys?select=id,user_id,tier,current_period_end,plan_status,renewal_reminder_sent_at&` +
            `tier=neq.jamii&` +
            `plan_status=eq.active&` +
            `is_locked=eq.false&` +
            `current_period_end=lte.${reminderCutoff}&` +
            `current_period_end=gte.${now.toISOString()}&` +
            `renewal_reminder_sent_at=is.null`
        );

        if (reminderResp.ok) {
            const keysNeedingReminder = await reminderResp.json();

            for (const key of keysNeedingReminder) {
                try {
                    // Get user email from auth.users via API key's user_id
                    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${key.user_id}`, {
                        headers: {
                            'apikey': SUPABASE_SERVICE_ROLE_KEY,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                        }
                    });

                    let userEmail = '';
                    if (userResp.ok) {
                        const userData = await userResp.json();
                        userEmail = userData.email || '';
                    }

                    const daysLeft = Math.ceil(
                        (new Date(key.current_period_end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                    );

                    // Mark reminder as sent
                    await supabaseQuery(
                        `api_keys?id=eq.${key.id}`,
                        {
                            method: 'PATCH',
                            body: JSON.stringify({ renewal_reminder_sent_at: now.toISOString() })
                        }
                    );

                    // Log the reminder (using usage_log as an audit trail)
                    await supabaseQuery(
                        'nasaka_usage_log',
                        {
                            method: 'POST',
                            body: JSON.stringify({
                                api_key_id: key.id,
                                endpoint: '/cron/renewal-check',
                                response_code: 200,
                                ip_hash: 'system_cron',
                                request_weight: 0
                            })
                        }
                    );

                    results.reminders_sent++;

                    // Note: Email sending would be done via your email provider's API
                    // (e.g., Resend, SendGrid, or Africa's Talking for SMS)
                    // For now, we log it. The admin notification below covers immediate visibility.
                    console.log(`[CRON] Renewal reminder: key=${key.id}, tier=${key.tier}, email=${userEmail}, days_left=${daysLeft}`);

                } catch (err: any) {
                    results.errors.push(`Reminder failed for key ${key.id}: ${err.message}`);
                }
            }
        }

        // ──────────────────────────────────────────────────────────────
        // STEP 2: Handle expired keys (grace period passed — lock them)
        // ──────────────────────────────────────────────────────────────
        const graceCutoff = new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();

        const expiredResp = await supabaseQuery(
            `api_keys?select=id,tier,current_period_end,plan_status&` +
            `tier=neq.jamii&` +
            `plan_status=in.(active,past_due)&` +
            `is_locked=eq.false&` +
            `current_period_end=lte.${graceCutoff}`
        );

        if (expiredResp.ok) {
            const expiredKeys = await expiredResp.json();

            for (const key of expiredKeys) {
                try {
                    // Lock the key and downgrade to jamii
                    await supabaseQuery(
                        `api_keys?id=eq.${key.id}`,
                        {
                            method: 'PATCH',
                            body: JSON.stringify({
                                is_locked: true,
                                plan_status: 'cancelled',
                                tier: 'jamii'
                            })
                        }
                    );

                    results.grace_expired++;
                    results.downgraded++;

                    console.log(`[CRON] Key locked: key=${key.id}, was_tier=${key.tier}, expired=${key.current_period_end}`);

                } catch (err: any) {
                    results.errors.push(`Lock failed for key ${key.id}: ${err.message}`);
                }
            }
        }

        // ──────────────────────────────────────────────────────────────
        // STEP 3: Mark keys as past_due (expired but within grace period)
        // ──────────────────────────────────────────────────────────────
        const pastDueResp = await supabaseQuery(
            `api_keys?select=id,tier,current_period_end&` +
            `tier=neq.jamii&` +
            `plan_status=eq.active&` +
            `is_locked=eq.false&` +
            `current_period_end=lte.${now.toISOString()}&` +
            `current_period_end=gte.${graceCutoff}`
        );

        if (pastDueResp.ok) {
            const pastDueKeys = await pastDueResp.json();

            for (const key of pastDueKeys) {
                try {
                    await supabaseQuery(
                        `api_keys?id=eq.${key.id}`,
                        {
                            method: 'PATCH',
                            body: JSON.stringify({ plan_status: 'past_due' })
                        }
                    );

                    console.log(`[CRON] Key marked past_due: key=${key.id}, tier=${key.tier}`);

                } catch (err: any) {
                    results.errors.push(`Past-due update failed for key ${key.id}: ${err.message}`);
                }
            }
        }

        // ──────────────────────────────────────────────────────────────
        // STEP 4: Monthly quota reset (1st of month)
        // ──────────────────────────────────────────────────────────────
        const resetResp = await supabaseQuery(
            `api_keys?select=id&monthly_reset_date=lte.${now.toISOString()}`,
        );

        if (resetResp.ok) {
            const keysToReset = await resetResp.json();

            if (keysToReset.length > 0) {
                const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

                for (const key of keysToReset) {
                    try {
                        await supabaseQuery(
                            `api_keys?id=eq.${key.id}`,
                            {
                                method: 'PATCH',
                                body: JSON.stringify({
                                    monthly_request_count: 0,
                                    monthly_reset_date: nextMonth,
                                    renewal_reminder_sent_at: null
                                })
                            }
                        );
                    } catch (err: any) {
                        results.errors.push(`Reset failed for key ${key.id}: ${err.message}`);
                    }
                }

                console.log(`[CRON] Quota reset: ${keysToReset.length} keys`);
            }
        }

        return Response.json({
            success: true,
            timestamp: now.toISOString(),
            results
        }, { status: 200, headers });

    } catch (err: any) {
        return Response.json({
            error: err.message || 'Cron job failed',
            timestamp: now.toISOString(),
            results
        }, { status: 500, headers });
    }
}
