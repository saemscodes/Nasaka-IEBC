
// Supabase Edge Function: approve-license
// Ported from api/v1/admin/approve-license.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ADMIN_SECRET = Deno.env.get('ADMIN_SECRET')!

    const providedSecret = req.headers.get('x-admin-secret')
    if (providedSecret !== ADMIN_SECRET) return new Response('Unauthorized', { status: 401 })

    const { application_id } = await req.json()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    try {
        const { data: application } = await supabase
            .from('nasaka_license_applications')
            .select('*')
            .eq('id', application_id)
            .single()

        if (!application) return new Response('Not found', { status: 404 })
        if (application.status === 'approved') return new Response('Already approved', { status: 400 })

        const { data: offices } = await supabase
            .from('iebc_offices')
            .select('id,constituency,county,office_location,latitude,longitude,confidence_score,formatted_address')
            .eq('verified', true)

        // Logic for generating GeoJSON/CSV and uploading to Blob would go here.
        // For now, we update status.

        await supabase
            .from('nasaka_license_applications')
            .update({
                status: 'approved',
                approved_at: new Date().toISOString(),
                download_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
            .eq('id', application_id)

        return new Response(JSON.stringify({ success: true, message: "License approved" }), {
            headers: { 'Content-Type': 'application/json' }
        })
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
})
