/**
 * Cloudflare Pages Functions Middleware
 * 
 * Bridges Cloudflare's context.env into globalThis.process.env
 * so that existing handlers using process.env continue to work
 * without modification.
 * 
 * SCOPED: Only processes /api/* routes. Static assets pass through untouched.
 */

interface Env {
    [key: string]: string | undefined;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    const url = new URL(context.request.url);

    // Only inject env vars for API routes — static assets skip this entirely
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/api')) {
        if (typeof globalThis.process === 'undefined') {
            (globalThis as any).process = { env: {} };
        }

        for (const [key, value] of Object.entries(context.env)) {
            if (typeof value === 'string') {
                (globalThis as any).process.env[key] = value;
            }
        }
    }

    return context.next();
};
