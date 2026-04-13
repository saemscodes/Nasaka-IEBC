import { handleCounties } from '../../../api/v1/main';
import { createLogger } from '../../../src/api-lib/logger';

export const onRequest: any = async (context: any) => {
    const logger = createLogger(context.request);
    return handleCounties(context.request, context.env.VITE_SUPABASE_URL || context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY, logger);
};
