/**
 * Cloudflare Worker: Nightly IEBC Data Sync
 * Queries Supabase and writes lean JSON to R2
 * Cron Trigger: 0 21 * * * (Midnight EAT)
 */

export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(handleSchedule(env));
    },
    async fetch(request, env) {
        // Manual trigger for testing
        if (new URL(request.url).pathname === '/sync') {
            await handleSchedule(env);
            return new Response('Sync completed successfully');
        }
        return new Response('IEBC Sync Worker is running');
    }
};

async function handleSchedule(env) {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('Fetching all offices from Supabase...');

    let allOffices = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const response = await fetch(`${supabaseUrl}/rest/v1/iebc_offices?select=id,latitude,longitude,office_location,clean_office_location,constituency_name,county,category,office_type,ward&order=id&offset=${from}&limit=${batchSize}`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Supabase fetch failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (data && data.length > 0) {
            allOffices = [...allOffices, ...data];
            if (data.length < batchSize) {
                hasMore = false;
            } else {
                from += batchSize;
            }
        } else {
            hasMore = false;
        }
    }

    // Extreme lean formatting
    const leanOffices = allOffices.map(o => ({
        i: o.id,
        lt: o.latitude,
        lg: o.longitude,
        n: o.clean_office_location || o.office_location,
        c: o.constituency_name,
        y: o.county,
        w: o.ward,
        t: o.category === 'registration_centre' ? 'rc' : 'off',
        ot: o.office_type
    }));

    // Write to R2
    console.log(`Writing ${leanOffices.length} offices to R2...`);
    await env.BUCKET.put('iebc-offices.json', JSON.stringify(leanOffices), {
        httpMetadata: {
            contentType: 'application/json',
            cacheControl: 'public, max-age=86400, stale-while-revalidate=3600'
        }
    });

    console.log('Sync completed successfully.');
}
