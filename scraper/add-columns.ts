/**
 * add-columns.ts
 * 
 * Adds the 4 missing columns to iebc_offices one at a time.
 * Each ALTER runs in its own connection with minimal overhead.
 * After success, proceeds to chunked ingest.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const dbUrl = process.env.SUPABASE_DB_POOLED_URL;
if (!dbUrl) { console.error('[FATAL] SUPABASE_DB_POOLED_URL missing'); process.exit(1); }

async function addColumn(colDef: string): Promise<boolean> {
    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        // First check if column exists
        const colName = colDef.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1];
        if (colName) {
            const check = await client.query(`
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'iebc_offices' 
                AND column_name = $1
            `, [colName]);
            if (check.rows.length > 0) {
                console.log(`  ✓ ${colName} already exists.`);
                return true;
            }
        }
        await client.query(`ALTER TABLE public.iebc_offices ${colDef}`);
        console.log(`  ✓ Added: ${colDef.split('EXISTS ')[1] || colDef}`);
        return true;
    } catch (e: any) {
        console.error(`  ✗ Failed: ${e.message}`);
        return false;
    } finally {
        await client.end();
    }
}

async function ingestChunk(offset: number, limit: number): Promise<number> {
    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        const result = await client.query(`
            INSERT INTO public.iebc_offices (
                county, constituency, constituency_name,
                office_location, clean_office_location,
                ward, centre_code,
                returning_officer_name, returning_officer_email,
                raw_scrape_text, office_type, category,
                source, verified, geocode_status, mapping_uuid
            )
            SELECT 
                rc.county, rc.constituency, rc.constituency,
                rc.name, rc.name,
                rc.ward, rc.centre_code,
                rc.returning_officer_name, rc.returning_officer_email,
                rc.raw_text, 'REGISTRATION_CENTRE', 'registration_centre',
                'IEBC_PORTAL_2026_SCRAPER', true, 'pending', rc.id
            FROM public.iebc_registration_centres rc
            ORDER BY rc.county, rc.constituency, rc.ward, rc.name
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        return result.rowCount || 0;
    } catch (e: any) {
        console.error(`  ✗ Chunk error at offset ${offset}: ${e.message}`);
        return -1;
    } finally {
        await client.end();
    }
}

async function main() {
    console.log('[MIGRATION] Phase 2 Retry: Adding missing columns...\n');

    const columns = [
        'ADD COLUMN IF NOT EXISTS returning_officer_name TEXT',
        'ADD COLUMN IF NOT EXISTS returning_officer_email TEXT',
        'ADD COLUMN IF NOT EXISTS raw_scrape_text TEXT',
        'ADD COLUMN IF NOT EXISTS mapping_uuid UUID',
    ];

    let allOk = true;
    for (const col of columns) {
        const ok = await addColumn(col);
        if (!ok) allOk = false;
    }

    if (!allOk) {
        console.error('\n[MIGRATION] Column addition failed. Cannot proceed with ingest.');
        console.error('[MIGRATION] Please add these columns via the Supabase SQL Editor manually.');
        process.exit(1);
    }

    console.log('\n[MIGRATION] All columns ready. Starting chunked ingest...\n');

    // Check current state
    const checkClient = new Client({ connectionString: dbUrl });
    await checkClient.connect();
    const srcCount = await checkClient.query('SELECT count(*) FROM public.iebc_registration_centres');
    const existingRC = await checkClient.query("SELECT count(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'");
    await checkClient.end();

    console.log(`[MIGRATION] Source: ${srcCount.rows[0].count} centres`);
    console.log(`[MIGRATION] Already in iebc_offices: ${existingRC.rows[0].count} REGISTRATION_CENTRE rows`);

    if (parseInt(existingRC.rows[0].count) > 20000) {
        console.log('[MIGRATION] Ingest appears complete. Skipping.');
    } else {
        const CHUNK = 500;
        let offset = 0;
        let totalInserted = 0;

        while (true) {
            const count = await ingestChunk(offset, CHUNK);
            if (count === 0) break;
            if (count === -1) {
                offset += CHUNK;
                continue;
            }
            totalInserted += count;
            offset += CHUNK;
            console.log(`  ✓ +${count} (total: ${totalInserted})`);
        }

        console.log(`\n[MIGRATION] Ingest complete: ${totalInserted} records.`);
    }

    // Verify
    const vClient = new Client({ connectionString: dbUrl });
    await vClient.connect();
    const total = await vClient.query('SELECT count(*) FROM public.iebc_offices');
    const rc = await vClient.query("SELECT count(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'");
    const counties = await vClient.query('SELECT count(DISTINCT county) FROM public.iebc_offices');
    await vClient.end();

    console.log(`\n[MIGRATION] ═══════════════════════════════════════`);
    console.log(`[MIGRATION] Total records:         ${total.rows[0].count}`);
    console.log(`[MIGRATION] Registration Centres:  ${rc.rows[0].count}`);
    console.log(`[MIGRATION] Counties:              ${counties.rows[0].count}`);
    console.log(`[MIGRATION] ═══════════════════════════════════════\n`);
}

main();
