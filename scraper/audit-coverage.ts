/**
 * audit-coverage.ts
 * Checks for missing counties or constituencies in the captured data.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function audit() {
  console.log('[AUDIT] Starting coverage check...');
  
  const { data: fullAudit, error: fErr } = await supabase
    .from('iebc_registration_centres')
    .select('county, constituency');

  if (fErr) {
    console.error('[ERROR]', fErr.message);
    return;
  }
  
  const counties = new Set(fullAudit.map(r => r.county));
  const constituencies = new Set(fullAudit.map(r => `${r.county}|${r.constituency}`));
  
  console.log(`[AUDIT] Total records in DB: ${fullAudit.length}`);
  console.log(`[AUDIT] Unique Counties: ${counties.size} / 48 (Target: 47 + Diaspora)`);
  console.log(`[AUDIT] Unique Constituencies: ${constituencies.size} / 290+`);
  
  // Find counties with unusually low counts (e.g. < 50)
  const countsByCounty: Record<string, number> = {};
  fullAudit.forEach(r => { countsByCounty[r.county] = (countsByCounty[r.county] || 0) + 1; });
  
  console.log('[AUDIT] Low Coverage Counties (Suspect):');
  Object.entries(countsByCounty).forEach(([county, count]) => {
     if (count < 100 && county !== 'DIASPORA' && county !== 'ISIOLO' && county !== 'LAMU' && county !== 'SAMBURU' && county !== 'TANA RIVER') {
        console.log(`  - ${county}: ${count} centres`);
     }
  });

  const gap = 24559 - fullAudit.length;
  console.log(`[AUDIT] Gap vs IEBC Statement: ${gap} centres (${((gap/24559)*100).toFixed(2)}%)`);
  
  if (counties.size >= 48 && constituencies.size >= 290) {
     console.log('[AUDIT] SUCCESS: Full geographic coverage achieved.');
  } else {
     console.log('[AUDIT] WARNING: Missing regions detected.');
  }
}

audit();
