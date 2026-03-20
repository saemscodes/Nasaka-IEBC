import handler from '../../../api/v1/stats';

export const onRequest: PagesFunction = async (context) => {
    return handler(context.request);
};
