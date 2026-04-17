import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Simple Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
    const tmp: number[][] = [];
    for (let i = 0; i <= a.length; i++) tmp[i] = [i];
    for (let j = 0; j <= b.length; j++) tmp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            tmp[i][j] = Math.min(
                tmp[i - 1][j] + 1,
                tmp[i][j - 1] + 1,
                tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return tmp[a.length][b.length];
}

async function run() {
    console.log('[HAM-MODE] Phase 4: Schema Hardening & Fuzzy Resolver...');

    // 1. DDL: Add Native RO Columns
    console.log('[1/3] Hardening Schema (Adding ROI columns)...');
    
    const dbUrl = process.env.SUPABASE_DB_POOLED_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    if (!dbUrl) {
        console.warn('  ! Warning: No database connection string found in ENV. Skipping DDL.');
    } else {
        const pg = new Client({ connectionString: dbUrl });
        await pg.connect();
        try {
            await pg.query(`
                ALTER TABLE public.iebc_offices 
                ADD COLUMN IF NOT EXISTS returning_officer_name TEXT,
                ADD COLUMN IF NOT EXISTS returning_officer_email TEXT;
            `);
            console.log('  ✓ Native columns added.');
        } catch (e: any) {
            console.warn('  ! DDL Warning:', e.message);
        } finally {
            await pg.end();
        }
    }

    // 2. Data Promotion (Direct SQL)
    console.log('[2/3] Promoting RO Metadata via Regex (Direct SQL)...');
    const pg2 = new Client({ connectionString: dbUrl });
    await pg2.connect();
    try {
        const res = await pg2.query(`
            UPDATE public.iebc_offices 
            SET 
                returning_officer_name = trim(substring(notes from 'RO_NAME:\\s*([^|]*)')),
                returning_officer_email = trim(substring(notes from 'RO_EMAIL:\\s*([^|]*)'))
            WHERE office_type = 'REGISTRATION_CENTRE' 
              AND notes ~ 'RO_NAME:|RO_EMAIL:';
        `);
        console.log(`  ✓ ${res.rowCount} records promoted.`);
    } catch (e: any) {
        console.error('  ! Promotion Error:', e.message);
    }

    // 3. Fuzzy Resolver (Still needs logic but will use PG for persistence)
    console.log('[3/3] Executing Fuzzy Resolver (Admin Mapping)...');
    const { data: wards } = await supabase.from('wards').select('ward_name, constituency, caw_code, id');
    const { data: orphans } = await supabase.from('iebc_offices').select('*').eq('office_type', 'REGISTRATION_CENTRE').is('caw_code', null);
    
    if (orphans && orphans.length > 0) {
        console.log(`  → fixing ${orphans.length} orphans...`);
        let fixed = 0;
        for (const row of orphans) {
            if (row.ward && row.constituency) {
                const candidates = wards?.filter(w => 
                    w.constituency?.toLowerCase().trim() === row.constituency.toLowerCase().trim()
                ) || [];

                let bestMatch: any = null;
                let minScore = 5;

                for (const c of candidates) {
                    const score = levenshtein(row.ward.toLowerCase().trim(), c.ward_name?.toLowerCase().trim() || '');
                    if (score < minScore) {
                        minScore = score;
                        bestMatch = c;
                    }
                }

                if (bestMatch) {
                    const centrePart = row.centre_code || '999';
                    const newCaw = `${bestMatch.caw_code}${centrePart}`;
                    await pg2.query(`
                        UPDATE public.iebc_offices 
                        SET caw_code = $1, ward_code = $2, ward_id = $3 
                        WHERE id = $4
                    `, [newCaw, bestMatch.caw_code, bestMatch.id, row.id]);
                    fixed++;
                }
            }
        }
        console.log(`  ✓ ${fixed} orphans resolved.`);
    }

    await pg2.end();
    console.log(`\n\n[COMPLETED] Phase 4 Hardening & Resolving Finished.`);
}

run().catch(console.error);
