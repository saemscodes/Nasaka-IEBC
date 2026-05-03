/**
 * Cloudflare Worker: Nightly IEBC Data Sync
 * Queries Supabase and writes lean JSON to R2
 * Cron Trigger: 0 21 * * * (Midnight EAT)
 */

// Global B2 Auth Cache (lasts up to 24h)
let cachedAuth = { token: null, apiUrl: null, downloadUrl: null, expires: 0 };

export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(handleSchedule(env));
    },
    async fetch(request, env) {
        const url = new URL(request.url);

        // 1. NIGHTLY SYNC ROUTE
        if (url.pathname === '/sync') {
            await handleSchedule(env);
            return new Response('Sync completed successfully');
        }

        // 2. SMART PROXY ROUTE: /file/map-data/:filename
        if (url.pathname.startsWith('/file/')) {
            return handleFileProxy(request, env);
        }

        return new Response('IEBC Proxy/Sync Worker is running', { status: 200 });
    }
};

/**
 * Handle File Proxying with B2 Auth & CORS
 */
async function handleFileProxy(request, env) {
    const url = new URL(request.url);
    const fileName = url.pathname.replace('/file/map-data/', '');

    // Security: Prevents path traversal
    if (fileName.includes('..') || fileName.startsWith('/')) {
        return new Response('Forbidden', { status: 403 });
    }

    try {
        // A. Get Auth (Cached or New)
        const auth = await getB2Auth(env);
        
        // B. Fetch from B2 (Private Bucket)
        // Format: {downloadUrl}/file/{bucketName}/{fileName}
        const b2Url = `${auth.downloadUrl}/file/nasaka-map-data/${fileName}`;
        
        const b2Response = await fetch(b2Url, {
            headers: { 'Authorization': auth.token },
            // Pass through browser's signal for abort handling
            signal: request.signal 
        });

        if (!b2Response.ok) {
            return new Response(`B2 Error: ${b2Response.status}`, { status: b2Response.status });
        }

        // C. Stream Response with CORS & Cache Headers
        const response = new Response(b2Response.body, b2Response);
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        response.headers.set('Cache-Control', 'public, max-age=2592000'); // 1 Month
        response.headers.set('Vary', 'Accept-Encoding');
        
        return response;

    } catch (err) {
        console.error('Proxy Error:', err);
        return new Response(`Proxy Error: ${err.message}`, { status: 500 });
    }
}

/**
 * Get B2 Auth Token with caching
 */
async function getB2Auth(env) {
    // Check if cache is still valid (using 23h buffer)
    if (cachedAuth.token && Date.now() < cachedAuth.expires) {
        return cachedAuth;
    }

    console.log('Fetching new B2 Auth Token...');
    const credentials = btoa(`${env.B2_APPLICATION_KEY_ID}:${env.B2_APPLICATION_KEY}`);
    
    const resp = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
        headers: { "Authorization": `Basic ${credentials}` }
    });

    if (!resp.ok) {
        throw new Error(`B2 Auth failed: ${resp.status}`);
    }

    const data = await resp.json();
    cachedAuth = {
        token: data.authorizationToken,
        apiUrl: data.apiUrl,
        downloadUrl: data.downloadUrl,
        expires: Date.now() + (23 * 60 * 60 * 1000) // 23h
    };

    return cachedAuth;
}

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
