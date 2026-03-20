import handler from '../../../api/v1/status';

export const onRequest: PagesFunction = async (context) => {
    return handler(context.request);
};
