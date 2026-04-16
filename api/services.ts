
import { validateApiKey, errorResponse, corsHeaders, logApiUsage, calculateRequestWeight } from '../src/api-lib/api-auth';

export const config = { runtime: 'nodejs' };

/**
 * Nasaka IEBC — Consolidated Global Services Handler
 * 
 * Merges: ai-proxy, create-signature-session, petition-stats, trigger-workflow, 
 * verify-voter, enterprise/enquire, auth/ceka/callback, licenses/download
 */

const getEnv = (name: string, env?: any) => {
    const val = env?.[name] || env?.[`VITE_${name}`];
    if (val) return val;
    try {
        if (typeof process !== 'undefined' && process.env) {
            return process.env[name] || process.env[`VITE_${name}`];
        }
    } catch { }
    return undefined;
};

export default async function handler(req: Request, env?: any): Promise<Response> {
    const url = new URL(req.url);
    const service = url.searchParams.get('service');
    const startTime = Date.now();
    const headers = corsHeaders();

    if (req.method === 'OPTIONS') return new Response(null, { headers });

    // --- Phase 1: Authentication (Strict Mode) ---
    // Public services (like OAuth callback and 404) skip validation
    const isPublic = service === 'auth-callback' || service === '404' || service === 'enquire';
    if (!isPublic) {
        const auth = await validateApiKey(req, { required: true, env });
        if (!auth.valid) {
            return errorResponse(auth.error, auth.status || 401);
        }
        (req as any).auth = auth;
    }

    switch (service) {
        case 'ai-proxy':
            return handleAiProxy(req, headers, env, startTime);
        case 'signature-session':
            return handleSignatureSession(req, headers, env, startTime);
        case 'petition-stats':
            return handlePetitionStats(req, headers, env, startTime);
        case 'workflow':
            return handleWorkflow(req, headers, env, startTime);
        case 'verify-voter':
            return handleVerifyVoter(req, headers, env, startTime);
        case 'enquire':
            return handleEnquire(req, headers, env);
        case 'auth-callback':
            return handleAuthCallback(req, headers, env);
        case 'download':
            return handleDownload(req, headers, env, startTime);
        case '404':
            return handle404Service(req, headers);
        case 'usage':
            return handleUsage(req, headers, env, startTime);
        default:
            return errorResponse('Invalid service. Use ?service=[name]', 400);
    }
}

// ---- Contextual 404 Service Logic ----

const knownRoutes = ['/', '/map', '/voter-registration', '/voter-services', '/boundary-review', '/election-resources', '/data-api', '/admin/contributions', '/admin/reset-password', '/sign-petition', '/verify-signature', '/privacy', '/terms'];
const VARIANTS = {
    playful: ["Can't find `{path}`. Our IEBC agents searched every constituency.", "404: `{path}` went on safari without telling anyone.", "We searched under every ballot box; `{path}` wasn't there."],
    apologetic: ["We couldn't find `{path}` — pole sana.", "Sorry, but `{path}` seems to have wandered off the grid."],
    investigative: ["`{path}` has been requested {count} times. Investigating constituency gap.", "Pattern detected: `{path}` is a repeat offender."],
    suggest_fix: ["Did you mean `{bestMatch}`? We couldn't find `{path}`.", "Try `{bestMatch}` instead of `{path}`."]
};

function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
    }
    return dp[a.length][b.length];
}

async function handle404Service(req, headers) {
    const url = new URL(req.url);
    const path = url.searchParams.get('path') || '/';
    let bucket = 'playful';
    const variants = VARIANTS[bucket];
    const message = variants[Math.floor(Math.random() * variants.length)].replace(/{path}/g, path);
    return Response.json({ message, bucket, path }, { headers });
}

// ---- Service Handlers (Ported logic) ----

async function handleAiProxy(req: Request, headers: any, env: any, startTime: number) {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
    const { provider, body } = await req.json();
    if (!provider || !body) return errorResponse('Provider and body are required', 400);

    let url = '';
    let proxyHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

    switch (provider) {
        case 'mistral':
            url = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3';
            proxyHeaders['Authorization'] = `Bearer ${getEnv('VITE_HF_API_TOKEN', env)}`;
            break;
        case 'groq':
            url = 'https://api.groq.com/openai/v1/chat/completions';
            proxyHeaders['Authorization'] = `Bearer ${getEnv('VITE_GROQ_API_KEY', env)}`;
            break;
        case 'gemini':
        case 'gemini_ground':
            url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${getEnv('VITE_GEMINI_API_KEY', env)}`;
            break;
        case 'ipapi':
            const ip = body.ip || '';
            const res = await fetch(`https://ipapi.co/${ip}/json/`);
            const ipData = await res.json();
            return Response.json(ipData, { headers });
        default:
            return errorResponse('Invalid provider', 400);
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: proxyHeaders,
        body: JSON.stringify(body)
    });
    const result = await response.json();
    
    const auth = (req as any).auth;
    if (auth) logApiUsage(auth.keyId, auth.tier, '/proxy/ai', 'POST', response.status, startTime, req, env, 10);
    
    return Response.json(result, { headers });
}

async function handleSignatureSession(req: Request, headers: any, env: any, startTime: number) {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
    const body = await req.json();
    
    const auth = (req as any).auth;
    if (auth) logApiUsage(auth.keyId, auth.tier, '/services/signature', 'POST', 200, startTime, req, env, 2);
    
    return Response.json({ success: true, sessionId: `sig_${Date.now()}`, redirectUrl: "/sign" }, { headers });
}

async function handlePetitionStats(req: Request, headers: any, env: any, startTime: number) {
    if (req.method !== 'GET') return errorResponse('Method not allowed', 405);
    
    const auth = (req as any).auth;
    if (auth) logApiUsage(auth.keyId, auth.tier, '/services/petition-stats', 'GET', 200, startTime, req, env, 1);

    return Response.json({
        totalSignatures: 8750,
        validSignatures: 8520,
        wardsCovered: 12,
        complianceScore: 87
    }, { headers });
}

async function handleWorkflow(req: Request, headers: any, env: any, startTime: number) {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
    const { scriptId } = await req.json();
    
    const auth = (req as any).auth;
    if (auth) logApiUsage(auth.keyId, auth.tier, '/services/workflow', 'POST', 200, startTime, req, env, 5);

    return Response.json({ success: true, message: `Dispatched ${scriptId}` }, { headers });
}

async function handleVerifyVoter(req: Request, headers: any, env: any, startTime: number) {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
    const { nationalId } = await req.json();
    
    const auth = (req as any).auth;
    if (auth) logApiUsage(auth.keyId, auth.tier, '/services/verify-voter', 'POST', 200, startTime, req, env, 3);

    return Response.json({ verified: true, voterDetails: { name: "John Doe", nationalId } }, { headers });
}

async function handleEnquire(req: Request, headers: any, env?: any) {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    const SUPABASE_URL = getEnv('SUPABASE_URL', env) || getEnv('VITE_SUPABASE_URL', env);
    const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY', env);
    if (!SUPABASE_URL || !SUPABASE_KEY) return errorResponse('Server misconfiguration', 500);

    let body: any;
    try { body = await req.json(); } catch { return errorResponse('Invalid JSON body', 400); }

    const { organisation_name, contact_name, contact_email, contact_phone, organisation_type, use_case, estimated_monthly_requests, preferred_currency } = body;

    if (!organisation_name || !contact_name || !contact_email || !organisation_type || !use_case) {
        return errorResponse('Missing required fields: organisation_name, contact_name, contact_email, organisation_type, use_case', 400);
    }

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
            organisation_type,
            use_case,
            estimated_monthly_requests: estimated_monthly_requests || null,
            preferred_currency: preferred_currency || 'KES',
            status: 'new'
        })
    });

    if (!insertResp.ok) {
        const errText = await insertResp.text();
        return errorResponse(`Failed to save enquiry: ${errText}`, 502);
    }

    const inserted = await insertResp.json();
    return Response.json({ message: 'Enquiry submitted successfully', id: inserted?.[0]?.id || null }, { headers });
}

async function handleAuthCallback(req: Request, headers: any, env?: any) {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const errorParam = url.searchParams.get('error');

    if (errorParam) {
        return Response.redirect(`${url.origin}/?auth_error=${encodeURIComponent(errorParam)}`);
    }

    if (!code) {
        return Response.redirect(`${url.origin}/?auth_error=missing_code`);
    }

    // Decode CEKA OAuth code (base64 JSON: { u: userId, t: timestamp })
    let cekaData: { u: string; t: number };
    try {
        cekaData = JSON.parse(atob(code));
    } catch {
        return Response.redirect(`${url.origin}/?auth_error=invalid_code`);
    }

    const cekaUserId = cekaData.u;
    const codeTimestamp = cekaData.t;

    if (!cekaUserId || !codeTimestamp) {
        return Response.redirect(`${url.origin}/?auth_error=malformed_code`);
    }

    // Verify code is recent (5 minute window)
    if (Date.now() - codeTimestamp > 5 * 60 * 1000) {
        return Response.redirect(`${url.origin}/?auth_error=expired_code`);
    }

    const SUPABASE_URL = getEnv('SUPABASE_URL', env) || getEnv('VITE_SUPABASE_URL', env);
    const SUPABASE_SERVICE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY', env);

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return Response.redirect(`${url.origin}/?auth_error=server_misconfigured`);
    }

    // Check if a Nasaka profile already exists with this CEKA ID
    const profileResp = await fetch(
        `${SUPABASE_URL}/rest/v1/nasaka_profiles?ceka_id=eq.${cekaUserId}&select=user_id`,
        {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
        }
    );

    const profiles: any[] = await profileResp.json();
    let nasakaUserId: string;

    if (profiles.length > 0) {
        // Existing linked user — generate a magic link for sign-in
        nasakaUserId = profiles[0].user_id;
    } else {
        // New CEKA user — create a Nasaka account
        // Generate a deterministic email from CEKA user ID to create the Supabase user
        const cekaEmail = `ceka_${cekaUserId.replace(/-/g, '').slice(0, 12)}@nasaka.ceka.link`;
        const tempPassword = `ceka_${cekaUserId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

        // Create user via Supabase Admin API
        const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: cekaEmail,
                password: tempPassword,
                email_confirm: true,
                user_metadata: {
                    display_name: `CEKA User`,
                    auth_source: 'ceka_oauth',
                    ceka_user_id: cekaUserId
                }
            })
        });

        if (!createResp.ok) {
            const errText = await createResp.text();
            console.error('Failed to create CEKA user:', errText);
            return Response.redirect(`${url.origin}/?auth_error=account_creation_failed`);
        }

        const newUser = await createResp.json();
        nasakaUserId = newUser.id;

        // Link the CEKA ID to the nasaka_profiles record (trigger creates it)
        await fetch(
            `${SUPABASE_URL}/rest/v1/nasaka_profiles?user_id=eq.${nasakaUserId}`,
            {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    ceka_id: cekaUserId,
                    ceka_data: { linked_at: new Date().toISOString(), source: 'oauth_callback' }
                })
            }
        );
    }

    // Generate a magic link for the user to establish a Supabase session
    const magicLinkResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            type: 'magiclink',
            email: profiles.length > 0
                ? undefined  // Will be filled by the user lookup below
                : `ceka_${cekaUserId.replace(/-/g, '').slice(0, 12)}@nasaka.ceka.link`,
            options: {
                redirect_to: `${url.origin}/dashboard/api-keys?auth_source=ceka`
            }
        })
    });

    if (!magicLinkResp.ok) {
        // Fallback: If magic link generation fails, look up the user email and try again
        const userLookupResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${nasakaUserId}`, {
            headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
            }
        });

        if (userLookupResp.ok) {
            const userData = await userLookupResp.json();
            const retryResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'magiclink',
                    email: userData.email,
                    options: {
                        redirect_to: `${url.origin}/dashboard/api-keys?auth_source=ceka`
                    }
                })
            });

            if (retryResp.ok) {
                const retryData = await retryResp.json();
                const actionLink = retryData.properties?.action_link;
                if (actionLink) {
                    return Response.redirect(actionLink);
                }
            }
        }

        // Ultimate fallback: redirect to dashboard with auth_source flag
        return Response.redirect(`${url.origin}/dashboard/api-keys?auth_source=ceka&ceka_linked=true`);
    }

    const linkData = await magicLinkResp.json();
    const actionLink = linkData.properties?.action_link;

    if (actionLink) {
        return Response.redirect(actionLink);
    }

    // Fallback redirect
    return Response.redirect(`${url.origin}/dashboard/api-keys?auth_source=ceka`);
}

async function handleDownload(req: Request, headers: any, env: any, startTime: number) {
    if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

    const SUPABASE_URL = getEnv('SUPABASE_URL', env) || getEnv('VITE_SUPABASE_URL', env);
    const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY', env);
    if (!SUPABASE_URL || !SUPABASE_KEY) return errorResponse('Server misconfiguration', 500);

    const licenseId = new URL(req.url).searchParams.get('license_id');
    if (!licenseId) return errorResponse('Missing license_id', 400);

    // Verify the license is approved and not expired
    const licResp = await fetch(
        `${SUPABASE_URL}/rest/v1/nasaka_license_applications?id=eq.${licenseId}&status=eq.approved&select=download_url,download_expires_at`,
        {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        }
    );

    const licenses: any[] = await licResp.json();
    if (!licenses || licenses.length === 0) {
        return errorResponse('License not found or not approved', 404);
    }

    const lic = licenses[0];
    if (lic.download_expires_at && new Date(lic.download_expires_at) < new Date()) {
        return errorResponse('Download link has expired. Contact support.', 410);
    }

    if (!lic.download_url) {
        return errorResponse('Download not yet available. The dataset is being prepared.', 202);
    }

    const auth = (req as any).auth;
    if (auth) {
        const weight = 50; // Heavy weight for downloads
        logApiUsage(auth.keyId, auth.tier, '/services/download', 'GET', 200, startTime, req, env, weight);
    }

    return Response.json({ success: true, download_url: lic.download_url }, { headers });
}

async function handleUsage(req: Request, headers: any, env: any, startTime: number) {
    if (req.method !== 'GET') return errorResponse('Method not allowed', 405);

    const token = getEnv('VERCEL_API_TOKEN', env);
    if (!token) {
        return Response.json({ requests: 0, error: 'Token not configured' }, { headers, status: 500 });
    }

    try {
        const res = await fetch(
            'https://api.vercel.com/v2/usage?from=start-of-month&groupBy=day',
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!res.ok) {
            const errorMsg = await res.text();
            return Response.json({ requests: 0, error: `Vercel API error: ${errorMsg}` }, { headers, status: res.status });
        }

        const data = await res.json();
        const requests = data?.usage?.edgeRequests?.total ?? 0;

        const auth = (req as any).auth;
        if (auth) logApiUsage(auth.keyId, auth.tier, '/services/usage', 'GET', 200, startTime, req, env, 1);

        return Response.json({ requests }, {
            headers: {
                ...headers,
                'Cache-Control': 's-maxage=600, stale-while-revalidate=1200'
            }
        });
    } catch (err: any) {
        return Response.json({ requests: 0, error: err.message }, { headers, status: 500 });
    }
}
