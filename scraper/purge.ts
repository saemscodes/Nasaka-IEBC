import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    console.log('[PURGE] Starting aggressive ID-based cleanup...');
    let total = 0;
    while (true) {
        // Fetch 500 IDs at a time
        const { data: records, error: fetchError } = await supabase
            .from('iebc_offices')
            .select('id')
            .eq('office_type', 'REGISTRATION_CENTRE')
            .limit(500);

        if (fetchError) {
            console.error('[FETCH ERROR]', fetchError.message);
            break;
        }
        if (!records || records.length === 0) break;

        const ids = records.map(r => r.id);
        const { error: delError } = await supabase
            .from('iebc_offices')
            .delete()
            .in('id', ids);

        if (delError) {
            console.error('[DELETE ERROR]', delError.message);
            break;
        }

        total += ids.length;
        process.stdout.write(`[PURGE] Deleted ${total}...\r`);
    }
    console.log(`\n[PURGE] SUCCESS. Total deleted: ${total}`);
}

run();
