import handler from '../../../api/v1/boundary';

export const onRequest: any = async (context: any) => {
    return handler(context.request, context.env);
};
