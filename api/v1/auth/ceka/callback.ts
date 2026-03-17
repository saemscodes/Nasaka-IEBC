export const config = { runtime: 'nodejs' };

/**
 * Nasaka IEBC — CEKA OAuth Callback Handler
 * Handles the redirect from civiceducationkenya.com after successful login.
 * 
 * Flow:
 * 1. Exchanges auth code for access token.
 * 2. Fetches user identity from CEKA.
 * 3. Links CEKA identity to Nasaka profile.
 * 4. Auto-generates a Jamii (Free) API key if one doesn't exist.
 * 5. Redirects to dashboard.
 */

export default async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // For CSRF protection if enabled

    // Configuration from environment
    const CLIENT_ID = process.env.CEKA_CLIENT_ID;
    const CLIENT_SECRET = process.env.CEKA_CLIENT_SECRET;
    const REDIRECT_URI = `${url.origin}/api/v1/auth/ceka/callback`;
    const TOKEN_URL = process.env.CEKA_OAUTH_TOKEN_URL || 'https://civiceducationkenya.com/api/oauth/token';
    const USER_URL = process.env.CEKA_OAUTH_USER_URL || 'https://civiceducationkenya.com/api/oauth/user';

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!code) {
        return Response.redirect(`${url.origin}/auth?error=missing_code`);
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return Response.redirect(`${url.origin}/auth?error=server_config`);
    }

    try {
        // 1. Exchange Authorization Code for Access Token
        const tokenResp = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI
            })
        });

        if (!tokenResp.ok) {
            const errBody = await tokenResp.text();
            throw new Error(`CEKA Token Exchange Failed: ${errBody}`);
        }

        const tokenData = await tokenResp.json();
        const access_token = tokenData.access_token;

        // 2. Fetch User Identity from CEKA Profile API
        const userResp = await fetch(USER_URL, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });

        if (!userResp.ok) {
            throw new Error('Failed to fetch user identity from CEKA');
        }

        const cekaUser = await userResp.json();
        const cekaId = String(cekaUser.id || cekaUser.uuid);
        const email = cekaUser.email;
        const displayName = cekaUser.name || cekaUser.display_name || email;

        // 3. Link CEKA Identity to Nasaka Record
        const supaHeaders = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };

        // Check if a key already exists for this CEKA user
        const keyLookupResp = await fetch(
            `${SUPABASE_URL}/rest/v1/api_keys?ceka_user_id=eq.${encodeURIComponent(cekaId)}&select=id,key_prefix`,
            { headers: supaHeaders }
        );
        const existingKeys = await keyLookupResp.json();

        if (existingKeys.length === 0) {
            // New User: Auto-generate their first Jamii (Free) Tier Key
            const prefix = 'niebc_jam_';
            const random = Array.from(crypto.getRandomValues(new Uint8Array(16)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            const rawKey = `${prefix}${random}`;

            // Hash the key for secure storage
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(rawKey);
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
            const hashHex = Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

            // Create the API key
            const createResp = await fetch(`${SUPABASE_URL}/rest/v1/api_keys`, {
                method: 'POST',
                headers: supaHeaders,
                body: JSON.stringify({
                    key_hash: hashHex,
                    key_prefix: prefix,
                    tier: 'jamii',
                    is_active: true,
                    ceka_user_id: cekaId,
                    display_name: `CEKA ID: ${cekaId} (${email})`,
                    plan_status: 'active'
                })
            });

            if (!createResp.ok) {
                const err = await createResp.text();
                throw new Error(`Failed to create auto-key: ${err}`);
            }
        }

        // 4. Update or Create Nasaka Profile
        await fetch(`${SUPABASE_URL}/rest/v1/nasaka_profiles`, {
            method: 'POST',
            headers: { ...supaHeaders, 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({
                ceka_id: cekaId,
                display_name: displayName,
                email: email,
                ceka_data: cekaUser,
                updated_at: new Date().toISOString()
            })
        });

        // 5. Final Redirect to Dashboard
        // NOTE: In a multi-project setup, you'd typically set a JWT cookie here
        // so the frontend knows who is logged in. 
        // For now, we redirect to dashboard which will handle session restoration.
        const dashboardUrl = new URL('/dashboard/api-keys', url.origin);
        dashboardUrl.searchParams.set('auth_source', 'ceka');
        dashboardUrl.searchParams.set('ceka_id', cekaId);

        return Response.redirect(dashboardUrl.toString());

    } catch (err: any) {
        console.error('[CEKA Auth Error]', err.message);
        return Response.redirect(`${url.origin}/auth?error=ceka_auth_failed&details=${encodeURIComponent(err.message)}`);
    }
}
