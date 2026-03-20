/**
 * Cloudflare Pages Functions Middleware
 * 
 * Bridges Cloudflare's context.env into globalThis.process.env
 * so that existing handlers using process.env continue to work
 * without modification.
 */

interface Env {
    [key: string]: string | undefined;
}

export const onRequest: PagesFunction<Env> = async (context) => {
    // Inject all env bindings into process.env for handler compatibility
    if (typeof globalThis.process === 'undefined') {
        (globalThis as any).process = { env: {} };
    }

    for (const [key, value] of Object.entries(context.env)) {
        if (typeof value === 'string') {
            (globalThis as any).process.env[key] = value;
        }
    }

    return context.next();
};
