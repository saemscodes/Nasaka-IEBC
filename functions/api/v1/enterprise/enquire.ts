import handler from '../../../api/services';

/** Alias: /api/v1/enterprise/enquire → services?service=enquire */
export const onRequest: PagesFunction = async (context) => {
    const url = new URL(context.request.url);
    url.searchParams.set('service', 'enquire');
    const rewritten = new Request(url.toString(), context.request);
    return handler(rewritten);
};
