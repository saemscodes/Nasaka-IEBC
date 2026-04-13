import { handleOfficeById } from '../../../../api/v1/main';

export const onRequest: any = async (context: any) => {
    const id = context.params.id;
    return handleOfficeById(context.request, context.env.VITE_SUPABASE_URL || context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY, id as string);
};
