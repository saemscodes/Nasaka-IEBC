import handler from '../../../api/v1/counties';

export const onRequest: PagesFunction = async (context) => {
    return handler(context.request);
};
