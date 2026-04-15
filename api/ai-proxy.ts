// api/ai-proxy.ts
// Nasaka AI Proxy — Vercel Serverless Function
// Server-side proxy for HuggingFace (Mistral-7B), Groq (Llama 3), and Google Gemini
// Keeps all API keys server-side, away from the browser bundle.

export const config = { runtime: 'nodejs' };

const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400',
};

function corsResponse(body: string | null, status: number, extraHeaders?: Record<string, string>): Response {
    return new Response(body, {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
    });
}

function errorResponse(message: string, status: number): Response {
    return corsResponse(JSON.stringify({ error: message }), status);
}

function getEnv(name: string, env?: any): string {
    return env?.[name] || process.env?.[name] || '';
}

export default async function handler(req: Request, env?: any): Promise<Response> {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    if (req.method !== 'POST') {
        return errorResponse('Method not allowed — use POST', 405);
    }

    let payload: { provider: string; body: any };
    try {
        payload = await req.json();
    } catch {
        return errorResponse('Invalid JSON body', 400);
    }

    const { provider, body } = payload;
    if (!provider || !body) {
        return errorResponse('Missing provider or body', 400);
    }

    let apiTarget = '';
    let authHeader = '';

    switch (provider) {
        case 'mistral': {
            const hfToken = getEnv('VITE_HF_API_TOKEN', env) || getEnv('HF_TOKEN', env) || getEnv('HF_API_TOKEN', env);
            if (!hfToken) return errorResponse('HuggingFace token not configured', 500);
            apiTarget = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';
            authHeader = `Bearer ${hfToken}`;
            break;
        }
        case 'groq': {
            const groqKey = getEnv('VITE_GROQ_API_KEY', env) || getEnv('GROQ_API_KEY', env);
            if (!groqKey) return errorResponse('Groq API key not configured', 500);
            apiTarget = 'https://api.groq.com/openai/v1/chat/completions';
            authHeader = `Bearer ${groqKey}`;
            break;
        }
        case 'gemini': {
            const geminiKey = getEnv('VITE_GEMINI_API_KEY', env) || getEnv('GEMINI_API_KEY', env);
            if (!geminiKey) return errorResponse('Gemini API key not configured', 500);
            apiTarget = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
            // Gemini auth via URL param, no Authorization header
            break;
        }
        case 'gemini_ground': {
            const geminiGroundKey = getEnv('VITE_GEMINI_API_KEY', env) || getEnv('GEMINI_API_KEY', env);
            if (!geminiGroundKey) return errorResponse('Gemini API key not configured', 500);
            apiTarget = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiGroundKey}`;
            break;
        }
        default:
            return errorResponse(`Unknown provider: ${provider}`, 400);
    }

    const upstreamHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) upstreamHeaders['Authorization'] = authHeader;

    let upstreamResp: Response;
    try {
        upstreamResp = await fetch(apiTarget, {
            method: 'POST',
            headers: upstreamHeaders,
            body: JSON.stringify(body),
        });
    } catch (err: any) {
        return errorResponse(`Upstream fetch failed: ${err.message}`, 502);
    }

    let responseData: any;
    try {
        responseData = await upstreamResp.json();
    } catch {
        return errorResponse('Upstream returned non-JSON response', 502);
    }

    return corsResponse(JSON.stringify(responseData), upstreamResp.status);
}
