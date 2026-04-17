/**
 * promote-ro-tier-2.ts
 * 
 * Promotes RO metadata from 'notes' field for ALL office types, 
 * focusing on CONSTITUENCY_OFFICE records that were missed in Tier 1.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });
const dbUrl = process.env.SUPABASE_DB_POOLED_URL || process.env.DATABASE_URL;

async function run() {
    const pg = new Client({ connectionString: dbUrl });
    await pg.connect();

    console.log('[ROI-TIER-2] Promoting RO metadata for all office types...');

    // Extract RO_NAME and RO_EMAIL from notes field where native columns are NULL
    const { rows } = await pg.query(`
        SELECT id, notes, office_type, office_location 
        FROM public.iebc_offices 
        WHERE returning_officer_name IS NULL 
          AND notes LIKE '%RO_NAME:%'
    `);

    console.log(`[ROI-TIER-2] Found ${rows.length} records needing promotion (Tier 2)...`);

    let fixed = 0;
    for (const row of rows) {
        const notes = row.notes || '';
        const nameMatch = notes.match(/RO_NAME:\s*([^|]+)/);
        const emailMatch = notes.match(/RO_EMAIL:\s*([^\s|]+)/);

        if (nameMatch || emailMatch) {
            const name = nameMatch ? nameMatch[1].trim() : null;
            const email = emailMatch ? emailMatch[1].trim() : null;

            await pg.query(`
                UPDATE public.iebc_offices 
                SET returning_officer_name = $1, returning_officer_email = $2 
                WHERE id = $3
            `, [name, email, row.id]);
            fixed++;
        }
    }

    console.log(`[ROI-TIER-2] Successfully promoted ${fixed} records.`);
    await pg.end();
}

run().catch(console.error);
