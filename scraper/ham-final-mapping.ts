import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const dbUrl = process.env.SUPABASE_DB_POOLED_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

function deepNormalize(s: string): string {
    return (s || '').toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/ ward$/g, '')
        .replace(/ constituency$/g, '')
        .replace(/ town$/g, '')
        .replace(/[^a-z0-9\s]/g, '') // CORRECTED RANGE
        .trim();
}

async function run() {
    console.log('[HAM-MAPPER] Phase 3.1: Final 100% Turnover Pass...');
    const pg = new Client({ connectionString: dbUrl });
    await pg.connect();

    // 1. Fetch ALL Wards
    const { data: wards } = await supabase.from('wards').select('ward_name, constituency, caw_code, id');
    if (!wards) return;
    
    const wardMap = new Map<string, any[]>();
    for (const w of wards) {
        const nCons = deepNormalize(w.constituency || '');
        if (!wardMap.has(nCons)) wardMap.set(nCons, []);
        wardMap.get(nCons)!.push(w);
    }

    // 2. Fetch Remaining Orphans
    const { data: orphans } = await supabase
        .from('iebc_offices')
        .select('id, ward, constituency, centre_code')
        .eq('office_type', 'REGISTRATION_CENTRE')
        .is('caw_code', null);

    if (!orphans || orphans.length === 0) {
        console.log('✓ 100% RELATIONAL INTEGRITY ACHIEVED.');
        return;
    }
    console.log(`[3/3] Resolving final ${orphans.length} orphans...`);

    let fixed = 0;
    for (const row of orphans) {
        const nCons = deepNormalize(row.constituency || '');
        const candidates = wardMap.get(nCons) || [];

        // Global fallback if constituency mismatch
        const searchPool = candidates.length > 0 ? candidates : wards;

        let bestMatch: any = null;
        let minScore = 20; // Maximum lenience for final pass
        const nWard = deepNormalize(row.ward || '');

        for (const c of searchPool) {
            const nCand = deepNormalize(c.ward_name || '');
            const dist = nWard === nCand ? 0 : 100; // Prefer Exact Match after normalization
            if (dist === 0) {
                bestMatch = c;
                break;
            }
        }

        if (bestMatch) {
            const centrePart = row.centre_code || '999';
            const newCaw = `${bestMatch.caw_code}${centrePart}`;
            await pg.query(`UPDATE public.iebc_offices SET caw_code = $1, ward_code = $2, ward_id = $3 WHERE id = $4`, [newCaw, bestMatch.caw_code, bestMatch.id, row.id]);
            fixed++;
        }
    }

    console.log(`\n[COMPLETE] Resolved ${fixed}/${orphans.length} orphans.`);
    console.log(`100% TURNOVER: ${orphans.length - fixed === 0 ? 'SUCCESS' : 'PENDING'}`);
    await pg.end();
}

run().catch(console.error);
