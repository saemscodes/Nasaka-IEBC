import handler from '../../../api/v1/coordinates';

export const onRequest: any = async (context: any) => {
    return handler(context.request, context.env);
};
