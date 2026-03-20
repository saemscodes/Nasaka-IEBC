import handler from '../../../api/v1/locate';

export const onRequest: PagesFunction = async (context) => {
    return handler(context.request);
};
