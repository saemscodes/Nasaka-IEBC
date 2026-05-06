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
        const providers = ['mistral', 'groq', 'gemini', 'claude']; // Priority list
        const mainProvider = provider || 'mistral';
        
        // Ensure main provider is first in attempt list
        const attemptList = [mainProvider, ...providers.filter(p => p !== mainProvider)];
        
        let lastError = null;

        for (const targetProvider of attemptList) {
            try {
                let apiTarget = '';
                let apiKeyHeader = '';
                let finalBody = JSON.stringify(body);

                switch (targetProvider) {
                    case 'mistral':
                        apiTarget = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';
                        apiKeyHeader = `Bearer ${getEnv('HF_API_TOKEN', env)}`;
                        break;
                    case 'groq':
                        apiTarget = 'https://api.groq.com/openai/v1/chat/completions';
                        apiKeyHeader = `Bearer ${getEnv('GROQ_API_KEY', env)}`;
                        // Ensure model is set for Groq
                        if (!body.model) {
                            const newBody = { ...body, model: 'llama-3.3-70b-versatile' };
                            finalBody = JSON.stringify(newBody);
                        }
                        break;
                    case 'gemini':
                        const geminiKey = getEnv('GEMINI_API_KEY', env);
                        if (!geminiKey) continue;
                        apiTarget = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
                        break;
                    default:
                        continue;
                }

                if (!apiTarget) continue;

                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (apiKeyHeader) headers['Authorization'] = apiKeyHeader;

                const aiResp = await fetch(apiTarget, { 
                    method: 'POST', 
                    headers, 
                    body: finalBody,
                    signal: AbortSignal.timeout(8000) // Don't hang forever
                });

                if (aiResp.ok) {
                    const data = await aiResp.json();
                    logApiUsage(auth.keyId, auth.tier, '/api/ai-proxy', 'POST', aiResp.status, startTime, req, env, 10);
                    return Response.json({ ...data, _provider: targetProvider }, { status: 200, headers: corsHeaders() });
                } else {
                    const err = await aiResp.text();
                    console.warn(`[AI PROXY] ${targetProvider} failed with ${aiResp.status}: ${err.substring(0, 100)}`);
                    lastError = { provider: targetProvider, status: aiResp.status, text: err };
                    continue; // Try next in chain
                }
            } catch (pErr: any) {
                console.warn(`[AI PROXY] ${targetProvider} exception: ${pErr.message}`);
                lastError = pErr;
                continue;
            }
        }

        return errorResponse(`All AI providers failed. Last error: ${lastError?.message || 'Unknown failure'}`, 502);

    } catch (err: any) {
        console.error('[AI PROXY FATAL]', err.message);
        return errorResponse(err.message, 500);
    }
}
