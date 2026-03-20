import handler from '../../../../api/v1/billing/paystack';

/** Alias: /api/v1/billing/initialize → paystack?action=initialize */
export const onRequest: PagesFunction = async (context) => {
    const url = new URL(context.request.url);
    url.searchParams.set('action', 'initialize');
    const rewritten = new Request(url.toString(), context.request);
    return handler(rewritten);
};
