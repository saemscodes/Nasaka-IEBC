import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    console.log('[NUCLEAR-PURGE] Starting aggressive dependency-ordered loop cleanup...');
    let totalCleared = 0;

    while (true) {
        // 1. Get IDs of offices we want to delete (batch of 2000)
        const { data: officesToClear } = await supabase
            .from('iebc_offices')
            .select('id')
            .eq('office_type', 'REGISTRATION_CENTRE')
            .limit(2000);

        if (!officesToClear || officesToClear.length === 0) {
            console.log('[NUCLEAR-PURGE] All registration centres cleared.');
            break;
        }

        const officeIds = officesToClear.map(o => o.id);

        // 2. Clear dependents
        const { data: contributions } = await supabase
            .from('iebc_office_contributions')
            .select('id')
            .in('office_id', officeIds);

        const contributionIds = (contributions || []).map(c => c.id);

        if (contributionIds.length > 0) {
            const batchSize = 250;
            for (let i = 0; i < contributionIds.length; i += batchSize) {
                const batch = contributionIds.slice(i, i + batchSize);
                await supabase.from('contribution_archive').delete().in('contribution_id', batch);
                await supabase.from('iebc_office_contributions').delete().in('id', batch);
            }
        }

        // 3. Delete from iebc_offices
        const { error } = await supabase
            .from('iebc_offices')
            .delete()
            .in('id', officeIds);

        if (error) {
            console.error('Office Delete Error:', error.message);
            // If we hit a hard constraint, we might need manual intervention on that specific row
            break;
        }

        totalCleared += officeIds.length;
        process.stdout.write(`Deleted ${totalCleared} rows total...\r`);
    }

    console.log('\n[NUCLEAR-PURGE] SUCCESS. THE WAY IS CLEAN.');
}

run();
