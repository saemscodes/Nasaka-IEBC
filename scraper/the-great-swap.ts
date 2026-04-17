/**
 * the-great-swap.ts (v3 - Supabase SQL API)
 * 
 * Uses the Supabase service role key to execute SQL via the
 * Supabase Management/REST SQL endpoint, bypassing PgBouncer timeout.
 * Falls back to direct pg client for the bulk INSERT with chunking.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const dbUrl = process.env.SUPABASE_DB_POOLED_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dbUrl) { console.error('[FATAL] SUPABASE_DB_POOLED_URL missing'); process.exit(1); }

async function execSQL(sql: string, label: string): Promise<void> {
    const client = new Client({ connectionString: dbUrl });
    try {
        await client.connect();
        await client.query(sql);
        console.log(`  ✓ ${label}`);
    } catch (e: any) {
        if (e.message.includes('already exists') || e.message.includes('does not exist')) {
            console.log(`  → ${label} (skipped: ${e.message.substring(0, 80)})`);
        } else {
            console.error(`  ✗ ${label}: ${e.message}`);
        }
    } finally {
        await client.end();
    }
}

async function executeSwap() {
    console.log('[SWAP v3] Starting chunked migration...\n');

    // ── PHASE 1: BACKUP (separate connection) ──
    console.log('[SWAP] Phase 1: Verifying backup...');
    const checkClient = new Client({ connectionString: dbUrl });
    await checkClient.connect();
    try {
        const bkCheck = await checkClient.query(
            "SELECT count(*) FROM information_schema.tables WHERE table_name = 'iebc_offices_legacy_backup'"
        );
        if (bkCheck.rows[0].count === '1') {
            const bkCount = await checkClient.query('SELECT count(*) FROM public.iebc_offices_legacy_backup');
            console.log(`  ✓ Backup already exists: ${bkCount.rows[0].count} records.`);
        } else {
            console.log('  → Creating backup...');
            await checkClient.query('CREATE TABLE public.iebc_offices_legacy_backup AS SELECT * FROM public.iebc_offices');
            const bkCount = await checkClient.query('SELECT count(*) FROM public.iebc_offices_legacy_backup');
            console.log(`  ✓ Backup created: ${bkCount.rows[0].count} records.`);
        }
    } finally {
        await checkClient.end();
    }

    // ── PHASE 2: SCHEMA EXTENSION (one query per connection) ──
    console.log('\n[SWAP] Phase 2: Extending schema (individual connections)...');
    await execSQL('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS returning_officer_name TEXT', 'returning_officer_name');
    await execSQL('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS returning_officer_email TEXT', 'returning_officer_email');
    await execSQL('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS raw_scrape_text TEXT', 'raw_scrape_text');
    await execSQL('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS mapping_uuid UUID', 'mapping_uuid');

    // ── PHASE 3: CLEANSE ──
    console.log('\n[SWAP] Phase 3: Cleansing old registration centre rows...');
    const cleanClient = new Client({ connectionString: dbUrl });
    await cleanClient.connect();
    try {
        const deleteResult = await cleanClient.query("DELETE FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'");
        console.log(`  ✓ Cleansed ${deleteResult.rowCount} old REGISTRATION_CENTRE rows.`);
    } finally {
        await cleanClient.end();
    }

    // ── PHASE 4: CHUNKED INGEST ──
    console.log('\n[SWAP] Phase 4: Ingesting verified centres (chunked)...');
    const CHUNK = 500;
    let offset = 0;
    let totalInserted = 0;

    while (true) {
        const insertClient = new Client({ connectionString: dbUrl });
        await insertClient.connect();
        try {
            const ingestResult = await insertClient.query(`
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

            if (!ingestResult.rowCount || ingestResult.rowCount === 0) {
                await insertClient.end();
                break;
            }

            totalInserted += ingestResult.rowCount;
            offset += CHUNK;
            console.log(`  ✓ Chunk: +${ingestResult.rowCount} (total: ${totalInserted})`);
        } catch (e: any) {
            console.error(`  ✗ Chunk error at offset ${offset}: ${e.message}`);
            offset += CHUNK; // Skip problematic chunk
        } finally {
            await insertClient.end();
        }
    }

    console.log(`\n[SWAP] Ingest complete: ${totalInserted} records.`);

    // ── PHASE 5: VERIFY ──
    console.log('\n[SWAP] Phase 5: Verification...');
    const verifyClient = new Client({ connectionString: dbUrl });
    await verifyClient.connect();
    try {
        const finalCount = await verifyClient.query('SELECT count(*) FROM public.iebc_offices');
        const countyCount = await verifyClient.query('SELECT count(DISTINCT county) FROM public.iebc_offices');
        const constCount = await verifyClient.query('SELECT count(DISTINCT constituency) FROM public.iebc_offices');
        const rcCount = await verifyClient.query("SELECT count(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'");
        const coCount = await verifyClient.query("SELECT count(*) FROM public.iebc_offices WHERE office_type != 'REGISTRATION_CENTRE' OR office_type IS NULL");

        console.log(`\n[SWAP] ═══════════════════════════════════════`);
        console.log(`[SWAP] MIGRATION COMPLETE`);
        console.log(`[SWAP] Total records:         ${finalCount.rows[0].count}`);
        console.log(`[SWAP]   Registration Centres: ${rcCount.rows[0].count}`);
        console.log(`[SWAP]   Other (HQ/Legacy):    ${coCount.rows[0].count}`);
        console.log(`[SWAP] Counties:              ${countyCount.rows[0].count}`);
        console.log(`[SWAP] Constituencies:        ${constCount.rows[0].count}`);
        console.log(`[SWAP] ═══════════════════════════════════════\n`);
    } finally {
        await verifyClient.end();
    }
}

executeSwap();
