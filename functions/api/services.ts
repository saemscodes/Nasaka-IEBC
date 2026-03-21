import handler from '../../api/services';

/**
 * Cloudflare Functions wrapper for /api/services
 * Routes: ?service=ai-proxy|signature-session|petition-stats|workflow|verify-voter|enquire|download|usage
 */
export const onRequest: any = async (context: any) => {
    return handler(context.request, context.env);
};

export default handler;
