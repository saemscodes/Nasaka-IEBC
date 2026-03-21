import handler from "../../../../api/v1/sandbox/init";

export const onRequest: any = async (context: any) => {
    return handler(context.request, context.env);
};
