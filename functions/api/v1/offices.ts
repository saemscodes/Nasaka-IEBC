import handler from '../../../api/v1/offices';

export const onRequest: PagesFunction = async (context) => {
    return handler(context.request);
};
