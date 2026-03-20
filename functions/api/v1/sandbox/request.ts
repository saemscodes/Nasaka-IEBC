import handler from "../../../../api/v1/sandbox/request";

export const onRequest: PagesFunction = async (context) => {
    for (const [key, val] of Object.entries(context.env)) {
        if (typeof val === 'string') (process.env as any)[key] = val;
    }
    return handler(context.request);
};
