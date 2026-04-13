import { handleStatus } from '../../../api/v1/main';

export const onRequest: any = async (context: any) => {
    return handleStatus(context.request, context.env.VITE_SUPABASE_URL || context.env.SUPABASE_URL, context.env.VITE_SUPABASE_ANON_KEY || context.env.SUPABASE_ANON_KEY);
};
