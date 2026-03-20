import handler from '../../../api/services';

/** Alias: /api/v1/licenses/download → services?service=download */
export const onRequest: PagesFunction = async (context) => {
    const url = new URL(context.request.url);
    url.searchParams.set('service', 'download');
    const rewritten = new Request(url.toString(), context.request);
    return handler(rewritten);
};
