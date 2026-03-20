import handler from '../../../../api/v1/billing/paystack';

/**
 * Cloudflare Functions wrapper for /api/v1/billing/paystack
 * Routes: ?action=initialize|verify|webhook|pricing
 * 
 * Also handles the rewrite aliases:
 *   /api/v1/billing/pricing    → ?action=pricing
 *   /api/v1/billing/initialize → ?action=initialize
 *   /api/v1/billing/verify     → ?action=verify
 *   /api/v1/billing/webhook    → ?action=webhook
 */
export const onRequest: PagesFunction = async (context) => {
    return handler(context.request);
};
