import handler from '../../../../api/v1/billing/paystack';

/** Alias: /api/v1/billing/verify → paystack?action=verify */
export const onRequest: PagesFunction = async (context) => {
    const url = new URL(context.request.url);
    url.searchParams.set('action', 'verify');
    const rewritten = new Request(url.toString(), context.request);
    return handler(rewritten);
};
