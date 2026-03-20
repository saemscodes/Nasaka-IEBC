import handler from '../../api/services';

/**
 * Cloudflare Functions wrapper for /api/services
 * Routes: ?service=ai-proxy|signature-session|petition-stats|workflow|verify-voter|enquire|download|usage
 */
export const onRequest: PagesFunction = async (context) => {
    return handler(context.request);
};
