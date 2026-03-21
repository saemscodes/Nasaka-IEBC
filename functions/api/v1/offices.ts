import handler from '../../../api/v1/offices';

export const onRequest: any = async (context: any) => {
    return handler(context.request, context.env);
};
