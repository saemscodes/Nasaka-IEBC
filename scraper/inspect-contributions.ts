import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    console.log('[SCHEMA] Inspecting contributions...');
    
    const { data: contribs, error: e1 } = await supabase.from('iebc_office_contributions').select('*').limit(1);
    if (!e1 && contribs && contribs.length > 0) {
        console.log('iebc_office_contributions columns:', Object.keys(contribs[0]));
    } else {
        console.log('iebc_office_contributions is empty or error:', e1?.message);
    }

    const { data: archive, error: e2 } = await supabase.from('contribution_archive').select('*').limit(1);
    if (!e2 && archive && archive.length > 0) {
        console.log('contribution_archive columns:', Object.keys(archive[0]));
    } else {
        console.log('contribution_archive is empty or error:', e2?.message);
    }
}

run();
