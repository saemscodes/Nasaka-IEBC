
// Supabase Edge Function: renewal-check
// Ported from api/v1/billing/cron/renewal-check.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

Deno.serve(async (req) => {
    const authHeader = req.headers.get('Authorization')!
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const now = new Date()
    const REMINDER_DAYS = 5
    const GRACE_DAYS = 3

    const results = {
        reminders_sent: 0,
        grace_expired: 0,
        downgraded: 0,
        errors: [] as string[]
    }

    try {
        // 1. Send renewal reminders (5 days before expiry)
        const reminderCutoff = new Date(now.getTime() + REMINDER_DAYS * 24 * 60 * 60 * 1000).toISOString()
        const { data: keysNeedingReminder, error: reminderError } = await supabase
            .from('api_keys')
            .select('id, user_id, tier, current_period_end, plan_status, renewal_reminder_sent_at')
            .neq('tier', 'jamii')
            .eq('plan_status', 'active')
            .eq('is_locked', false)
            .lte('current_period_end', reminderCutoff)
            .gte('current_period_end', now.toISOString())
            .is('renewal_reminder_sent_at', null)

        if (keysNeedingReminder) {
            for (const key of keysNeedingReminder) {
                try {
                    await supabase
                        .from('api_keys')
                        .update({ renewal_reminder_sent_at: now.toISOString() })
                        .eq('id', key.id)

                    await supabase
                        .from('nasaka_usage_log')
                        .insert({
                            api_key_id: key.id,
                            endpoint: '/cron/renewal-check',
                            response_code: 200,
                            ip_hash: 'system_cron',
                            request_weight: 0
                        })

                    results.reminders_sent++
                    console.log(`[CRON] Renewal reminder sent: key=${key.id}`)
                } catch (err: any) {
                    results.errors.push(`Reminder failed for key ${key.id}: ${err.message}`)
                }
            }
        }

        // 2. Handle expired keys (grace period passed)
        const graceCutoff = new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()
        const { data: expiredKeys } = await supabase
            .from('api_keys')
            .select('id, tier, current_period_end, plan_status')
            .neq('tier', 'jamii')
            .in('plan_status', ['active', 'past_due'])
            .eq('is_locked', false)
            .lte('current_period_end', graceCutoff)

        if (expiredKeys) {
            for (const key of expiredKeys) {
                await supabase
                    .from('api_keys')
                    .update({ is_locked: true, plan_status: 'cancelled', tier: 'jamii' })
                    .eq('id', key.id)
                results.grace_expired++
                results.downgraded++
            }
        }

        // 3. Mark past_due
        const { data: pastDueKeys } = await supabase
            .from('api_keys')
            .select('id, tier, current_period_end')
            .neq('tier', 'jamii')
            .eq('plan_status', 'active')
            .eq('is_locked', false)
            .lte('current_period_end', now.toISOString())
            .gte('current_period_end', graceCutoff)

        if (pastDueKeys) {
            for (const key of pastDueKeys) {
                await supabase
                    .from('api_keys')
                    .update({ plan_status: 'past_due' })
                    .eq('id', key.id)
            }
        }

        // 4. Monthly quota reset
        const { data: keysToReset } = await supabase
            .from('api_keys')
            .select('id')
            .lte('monthly_reset_date', now.toISOString())

        if (keysToReset && keysToReset.length > 0) {
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
            for (const key of keysToReset) {
                await supabase
                    .from('api_keys')
                    .update({ monthly_request_count: 0, monthly_reset_date: nextMonth, renewal_reminder_sent_at: null })
                    .eq('id', key.id)
            }
        }

        return new Response(JSON.stringify({ success: true, results }), { headers: { 'Content-Type': 'application/json' } })
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
})
