import handler from '../../../../api/v1/billing/paystack';

/** Alias: /api/v1/billing/verify → paystack?action=verify */
export const onRequest: any = async (context: any) => {
    return handler(context.request, context.env);
};
