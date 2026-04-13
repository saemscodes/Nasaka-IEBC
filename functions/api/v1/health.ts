import { handleHealth } from '../../../api/v1/main';

export const onRequest: any = async (context: any) => {
    return handleHealth(context.env.VITE_SUPABASE_URL || context.env.SUPABASE_URL);
};
