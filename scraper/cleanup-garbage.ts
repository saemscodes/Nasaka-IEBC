/**
 * cleanup-garbage.ts
 * Purges known sidebar noise and duplicates from the iebc_registration_centres table.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const garbageNames = [
  'Speeches', 'FAQs', 'Statistics of Voters 2022', 'Gallery', 
  'About IEBC', 'Contacts', 'Download Forms', 'Party list', 'Complaint Forms'
];

async function cleanup() {
  console.log('[CLEANUP] Starting purge...');
  
  const { count, error } = await supabase
    .from('iebc_registration_centres')
    .delete({ count: 'exact' })
    .in('name', garbageNames);

  if (error) {
    console.error('[CLEANUP ERROR]', error.message);
  } else {
    console.log(`[CLEANUP] Purged ${count} garbage records.`);
  }

  // Also remove where name == county or name == constituency (scraped from breadcrumbs/headers)
  const { data: allData, error: fetchError } = await supabase
    .from('iebc_registration_centres')
    .select('id, name, county, constituency');

  if (fetchError) {
     console.error('[FETCH ERROR]', fetchError.message);
     return;
  }

  const badIds = allData
    .filter(row => row.name === row.county || row.name === row.constituency)
    .map(row => row.id);

  if (badIds.length > 0) {
    const { error: delError } = await supabase
      .from('iebc_registration_centres')
      .delete()
      .in('id', badIds);
    if (delError) console.error('[DEL ERROR]', delError.message);
    else console.log(`[CLEANUP] Purged ${badIds.length} hierarchical header records.`);
  }

  console.log('[CLEANUP] Done.');
}

cleanup();
