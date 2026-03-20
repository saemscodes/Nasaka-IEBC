import handler from '../../../api/v1/coordinates';

export const onRequest: PagesFunction = async (context) => {
    return handler(context.request);
};
