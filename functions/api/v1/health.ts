import handler from '../../../api/v1/health';

export const onRequest: PagesFunction = async (context) => {
    return handler(context.request);
};
