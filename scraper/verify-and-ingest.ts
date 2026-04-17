/**
 * verify-and-ingest.ts
 * 
 * Step 1: Check if RO columns exist on iebc_offices
 * Step 2: If not, try adding them
 * Step 3: If columns exist, run chunked ingest from iebc_registration_centres
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });
const dbUrl = process.env.SUPABASE_DB_POOLED_URL;
if (!dbUrl) { console.error('[FATAL] SUPABASE_DB_POOLED_URL missing'); process.exit(1); }

async function checkColumn(name: string): Promise<boolean> {
    const c = new Client({ connectionString: dbUrl });
    await c.connect();
    const r = await c.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='iebc_offices' AND column_name=$1
    `, [name]);
    await c.end();
    return r.rows.length > 0;
}

async function main() {
    // ── Step 1: Check columns ──
    console.log('[CHECK] Verifying required columns...');
    const needed = ['returning_officer_name', 'returning_officer_email', 'raw_scrape_text', 'mapping_uuid'];
    const status: Record<string, boolean> = {};
    for (const col of needed) {
        status[col] = await checkColumn(col);
        console.log(`  ${status[col] ? '✓' : '✗'} ${col}`);
    }

    const missing = needed.filter(c => !status[c]);
    if (missing.length > 0) {
        console.log(`\n[CHECK] Missing columns: ${missing.join(', ')}`);
        console.log('[CHECK] Attempting to add via pooled connection...');
        
        for (const col of missing) {
            const c = new Client({ connectionString: dbUrl });
            try {
                await c.connect();
                const type = col === 'mapping_uuid' ? 'UUID' : 'TEXT';
                await c.query(`ALTER TABLE public.iebc_offices ADD COLUMN ${col} ${type}`);
                console.log(`  ✓ Added ${col}`);
            } catch (e: any) {
                console.error(`  ✗ ${col}: ${e.message}`);
                console.log(`\n[MANUAL] Please run in Supabase SQL Editor:`);
                console.log(`  ALTER TABLE public.iebc_offices ADD COLUMN ${col} ${col === 'mapping_uuid' ? 'UUID' : 'TEXT'};`);
            } finally {
                await c.end();
            }
        }

        // Re-check
        let allGood = true;
        for (const col of missing) {
            const exists = await checkColumn(col);
            if (!exists) { allGood = false; console.error(`[FATAL] ${col} still missing.`); }
        }
        if (!allGood) {
            console.error('\n[FATAL] Cannot proceed. Add columns manually via Supabase SQL Editor.');
            process.exit(1);
        }
    }

    console.log('\n[CHECK] All columns verified. ✓\n');

    // ── Step 2: Check current state ──
    const stateClient = new Client({ connectionString: dbUrl });
    await stateClient.connect();
    const total = await stateClient.query('SELECT count(*) FROM public.iebc_offices');
    const rcCount = await stateClient.query("SELECT count(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'");
    const srcCount = await stateClient.query('SELECT count(*) FROM public.iebc_registration_centres');
    await stateClient.end();

    console.log(`[STATE] iebc_offices total: ${total.rows[0].count}`);
    console.log(`[STATE] REGISTRATION_CENTRE rows: ${rcCount.rows[0].count}`);
    console.log(`[STATE] Source (registration_centres): ${srcCount.rows[0].count}`);

    if (parseInt(rcCount.rows[0].count) >= parseInt(srcCount.rows[0].count) - 10) {
        console.log('\n[INGEST] Data already ingested. Skipping.');
        return;
    }

    // ── Step 3: Chunked Ingest ──
    console.log('\n[INGEST] Starting chunked ingest...\n');
    const CHUNK = 500;
    let offset = 0;
    let totalInserted = 0;

    while (true) {
        const ic = new Client({ connectionString: dbUrl });
        try {
            await ic.connect();
            const result = await ic.query(`
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
            `, [CHUNK, offset]);

            const inserted = result.rowCount || 0;
            if (inserted === 0) { await ic.end(); break; }
            totalInserted += inserted;
            offset += CHUNK;
            console.log(`  ✓ +${inserted} (total: ${totalInserted})`);
        } catch (e: any) {
            console.error(`  ✗ Chunk at offset ${offset}: ${e.message}`);
            offset += CHUNK;
        } finally {
            await ic.end();
        }
    }

    // ── Final Verify ──
    const vc = new Client({ connectionString: dbUrl });
    await vc.connect();
    const ft = await vc.query('SELECT count(*) FROM public.iebc_offices');
    const frc = await vc.query("SELECT count(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'");
    const fc = await vc.query('SELECT count(DISTINCT county) FROM public.iebc_offices');
    await vc.end();

    console.log(`\n[DONE] ═══════════════════════════════════════`);
    console.log(`[DONE] Total records:         ${ft.rows[0].count}`);
    console.log(`[DONE] Registration Centres:  ${frc.rows[0].count}`);
    console.log(`[DONE] Counties:              ${fc.rows[0].count}`);
    console.log(`[DONE] Inserted this run:     ${totalInserted}`);
    console.log(`[DONE] ═══════════════════════════════════════\n`);
}

main();
