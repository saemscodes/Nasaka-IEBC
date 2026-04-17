/**
 * inspect-data.ts (Reference Audit)
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  console.log('[CHECK] Auditing Reference Table (wards)...');
  const { data: consts } = await supabase
    .from('wards')
    .select('constituency');

  const uniqueConsts = Array.from(new Set(consts?.map(c => (c.constituency || '').toUpperCase().trim())));
  console.log(`[CHECK] Found ${uniqueConsts.length} unique constituencies in 'wards' table.`);
  
  if (uniqueConsts.length < 290) {
    console.log(`⚠️  CRITICAL: You have only ${uniqueConsts.length}/290 constituencies!`);
    console.log('Sample missing clusters likely: Bomet, Migori, etc.');
  } else {
    console.log('✓ All 290 constituencies present in reference.');
  }
}

check();
