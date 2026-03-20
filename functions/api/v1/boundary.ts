import handler from '../../../api/v1/boundary';

export const onRequest: PagesFunction = async (context) => {
    return handler(context.request);
};
