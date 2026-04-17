import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    console.log('[SANITY-CHECK] Fetching sample registration centre...');
    const { data, error } = await supabase
        .from('iebc_offices')
        .select('*')
        .eq('office_type', 'REGISTRATION_CENTRE')
        .limit(3);

    if (error) {
        console.error('Fetch Error:', error.message);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No data found!');
        return;
    }

    console.log('Sample Data (Rows: ' + data.length + '):');
    data.forEach(row => {
        console.log(`- [${row.caw_code}] ${row.office_location}`);
        console.log(`  Notes Sample: ${row.notes?.substring(0, 100)}...`);
    });
}

run();
