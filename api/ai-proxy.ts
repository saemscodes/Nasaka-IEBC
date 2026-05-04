export const config = { runtime: 'edge' };

import { validateApiKey, errorResponse, corsHeaders, logApiUsage } from '../src/api-lib/api-auth';

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
    const startTime = Date.now();
    
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    try {
        // Simple auth check
        const auth = await validateApiKey(req, { required: true, env });
        if (!auth.valid) return errorResponse(auth.error, auth.status || 401);

        const { provider, body } = await req.json();

        let apiTarget = '';
        let apiKey = '';
        let finalBody = JSON.stringify(body);

        switch (provider) {
            case 'mistral':
                apiTarget = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';
                apiKey = `Bearer ${getEnv('HF_API_TOKEN', env) || getEnv('VITE_HF_API_TOKEN', env)}`;
                break;
            case 'groq':
                apiTarget = 'https://api.groq.com/openai/v1/chat/completions';
                apiKey = `Bearer ${getEnv('GROQ_API_KEY', env) || getEnv('VITE_GROQ_API_KEY', env)}`;
                break;
            case 'gemini':
            case 'gemini_ground':
                const keyName = provider === 'gemini_ground' ? 'GEMINI_API_KEY' : 'GEMINI_API_KEY';
                const geminiKey = getEnv(keyName, env) || getEnv(`VITE_${keyName}`, env);
                const model = provider === 'gemini_ground' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
                apiTarget = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
                break;
            default:
                return errorResponse('Invalid provider', 400);
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = apiKey;

        const aiResp = await fetch(apiTarget, { method: 'POST', headers, body: finalBody });
        const data = await aiResp.json();
        
        logApiUsage(auth.keyId, auth.tier, '/api/ai-proxy', 'POST', aiResp.status, startTime, req, env, 10);
        
        return Response.json(data, { status: aiResp.status, headers: corsHeaders() });

    } catch (err: any) {
        console.error('[AI PROXY FATAL]', err.message);
        return errorResponse(err.message, 500);
    }
}
