import handler from '../../api/ai-proxy';

/**
 * Cloudflare Pages Function for /api/ai-proxy
 * Bridges the Vercel-style handler to Cloudflare Workers runtime.
 * travelService, aiService, and useGeolocation POST to this endpoint.
 */
export const onRequest: any = async (context: any) => {
  // Bridge Cloudflare env vars to globalThis.process.env for getEnv() compatibility
  if (!globalThis.process) (globalThis as any).process = { env: {} };
  Object.assign(globalThis.process.env, context.env);

  return handler(context.request, context.env);
};
