
// src/api/ai-proxy.ts
// Proxy for Hugging Face, Groq, and Gemini APIs to solve CORS and 403 errors
// Using Vercel edge/serverless function approach

export default async function handler(req: Request): Promise<Response> {
    // ─── Only allow POST ────────────────────────────────────────────────────────
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const { provider, body } = await req.json();

        if (!provider || !body) {
            return Response.json({ error: 'Provider and body are required' }, { status: 400 });
        }

        let url = '';
        let headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };

        // ─── Select Provider Configuration ────────────────────────────────────────
        switch (provider) {
            case 'mistral':
                url = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3';
                headers['Authorization'] = `Bearer ${process.env.VITE_HF_API_TOKEN}`;
                break;
            case 'groq':
                url = 'https://api.groq.com/openai/v1/chat/completions';
                headers['Authorization'] = `Bearer ${process.env.VITE_GROQ_API_KEY}`;
                break;
            case 'gemini':
            case 'gemini_ground':
                url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.VITE_GEMINI_API_KEY}`;
                break;
            default:
                return Response.json({ error: 'Invalid provider' }, { status: 400 });
        }

        // ─── Forward the request ──────────────────────────────────────────────────
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(20000) // 20s timeout for AI response
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AI Proxy] ${provider} error (${response.status}):`, errorText);
            return new Response(errorText, {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = await response.json();
        return Response.json(data);

    } catch (error: any) {
        console.error('[AI Proxy] Exception:', error);
        return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
