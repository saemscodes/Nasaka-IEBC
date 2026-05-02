/**
 * iebc_offices_rebuild.cjs
 *
 * Nasaka IEBC Offices Full Rebuild Pipeline — Phase A → E
 *
 * Phases:
 *   A) Create public.returning_officer table with FK to iebc_registration_centres.
 *   B) Backup current public.iebc_offices to iebc_offices_backup_20260425.
 *   C) Truncate iebc_offices and repopulate from iebc_registration_centres (column-mapped).
 *   D) Queue all rows with NULL coords for v14.4 geocoding.
 *   E) Confirm readiness and print summary for concurrent enrichment.
 *
 * Run:  node scripts/iebc_offices_rebuild.cjs
 */

'use strict';

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// ─── ENV LOADER ──────────────────────────────────────────────────────────────
function loadDotEnv() {
    const envPath = path.resolve(__dirname, '../.env');
    if (!fs.existsSync(envPath)) { console.error('[FATAL] .env not found'); process.exit(1); }
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) return;
        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (key) process.env[key] = val;
    });
}
loadDotEnv();

const DB_URL = process.env.SUPABASE_DB_POOLED_URL;
if (!DB_URL) { console.error('[FATAL] SUPABASE_DB_POOLED_URL missing'); process.exit(1); }

// ─── LOGGER ──────────────────────────────────────────────────────────────────
const LOG_FILE = path.resolve(__dirname, '../data/rebuild_log.txt');
const logLines = [];
function log(msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}`;
    console.log(line);
    logLines.push(line);
}
function flushLog() {
    fs.writeFileSync(LOG_FILE, logLines.join('\n'), 'utf-8');
}

// ─── DB CLIENT ───────────────────────────────────────────────────────────────
async function getClient() {
    const c = new Client({ connectionString: DB_URL });
    await c.connect();
    return c;
}

// ─── PHASE A: Create returning_officer table ─────────────────────────────────
async function phaseA(c) {
    log('=== PHASE A: Configuring public.returning_officer table ===');

    // Read existing columns
    const colRes = await c.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='returning_officer'
    `);

    if (colRes.rows.length === 0) {
        // Create from scratch
        await c.query(`
            CREATE TABLE public.returning_officer (
                id              BIGSERIAL                PRIMARY KEY,
                name            TEXT,
                email           TEXT,
                centre_code     TEXT,
                rc_id           UUID,
                office_id       BIGINT,
                county          TEXT,
                constituency    TEXT,
                ward            TEXT,
                created_at      TIMESTAMPTZ              DEFAULT NOW(),
                updated_at      TIMESTAMPTZ              DEFAULT NOW()
            );
        `);
        log('[PHASE A] returning_officer table created from scratch.');
    } else {
        log('[PHASE A] returning_officer table exists — checking for missing columns...');
        const existingCols = new Set(colRes.rows.map(r => r.column_name));
        const neededCols = [
            ['centre_code', 'TEXT'],
            ['rc_id',       'UUID'],
            ['office_id',   'BIGINT'],
            ['county',      'TEXT'],
            ['constituency','TEXT'],
            ['ward',        'TEXT'],
            ['updated_at',  'TIMESTAMPTZ DEFAULT NOW()']
        ];
        for (const [col, def] of neededCols) {
            if (!existingCols.has(col)) {
                await c.query(`ALTER TABLE public.returning_officer ADD COLUMN IF NOT EXISTS ${col} ${def}`);
                log(`[PHASE A]   + Added column: ${col}`);
            }
        }
        // Add indexes if not present
        await c.query(`CREATE INDEX IF NOT EXISTS idx_ro_centre_code ON public.returning_officer(centre_code)`);
        await c.query(`CREATE INDEX IF NOT EXISTS idx_ro_rc_id       ON public.returning_officer(rc_id)`);
        await c.query(`CREATE INDEX IF NOT EXISTS idx_ro_office_id   ON public.returning_officer(office_id)`);

        // Ensure the id column has an auto-increment default (it is BIGINT without sequence)
        await c.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_attrdef d
                    JOIN pg_class c ON c.oid = d.adrelid
                    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.adnum
                    WHERE c.relname = 'returning_officer' AND a.attname = 'id'
                ) THEN
                    CREATE SEQUENCE IF NOT EXISTS returning_officer_id_seq;
                    ALTER TABLE public.returning_officer ALTER COLUMN id SET DEFAULT nextval('returning_officer_id_seq');
                    PERFORM setval('returning_officer_id_seq', COALESCE((SELECT MAX(id) FROM public.returning_officer), 0) + 1, false);
                END IF;
            END;
            $$;
        `);
        log('[PHASE A] returning_officer.id sequence ensured.');
    }

    // Seed from iebc_registration_centres
    const seedRes = await c.query(`
        INSERT INTO public.returning_officer (name, email, centre_code, rc_id, county, constituency, ward)
        SELECT DISTINCT ON (rc.constituency, rc.returning_officer_name)
            rc.returning_officer_name,
            rc.returning_officer_email,
            rc.centre_code,
            rc.id,
            rc.county,
            rc.constituency,
            rc.ward
        FROM public.iebc_registration_centres rc
        WHERE rc.returning_officer_name IS NOT NULL
        ON CONFLICT DO NOTHING
        RETURNING id
    `);
    log(`[PHASE A] Seeded ${seedRes.rowCount} returning officer records.`);
}

// ─── PHASE B: Backup iebc_offices ─────────────────────────────────────────────
async function phaseB(c) {
    log('=== PHASE B: Creating backup of public.iebc_offices ===');

    const backupTable = 'iebc_offices_backup_20260425';
    const tableExists = await c.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema='public' AND table_name=$1
    `, [backupTable]);

    if (tableExists.rows.length > 0) {
        log(`[PHASE B] Backup table ${backupTable} already exists — skipping backup.`);
        return;
    }

    await c.query(`CREATE TABLE public.${backupTable} AS SELECT * FROM public.iebc_offices`);
    const countRes = await c.query(`SELECT count(*) FROM public.${backupTable}`);
    log(`[PHASE B] Backup created: ${backupTable} with ${countRes.rows[0].count} rows.`);
}

// ─── PHASE C: Truncate & Rebuild iebc_offices from iebc_registration_centres ──
async function phaseC(c) {
    log('=== PHASE C: Rebuilding iebc_offices from iebc_registration_centres ===');

    // Pre-flight count
    const rcCount = await c.query(`SELECT count(*) FROM public.iebc_registration_centres`);
    log(`[PHASE C] Source rows in iebc_registration_centres: ${rcCount.rows[0].count}`);

    // TRUNCATE — preserving table structure and all indexes/constraints
    await c.query(`TRUNCATE TABLE public.iebc_offices RESTART IDENTITY CASCADE`);
    log('[PHASE C] iebc_offices truncated.');

    // INSERT with explicit column mapping (RC 18 cols → Offices 66 cols)
    // All enrichment columns (elevation, landmark, isochrone etc.) start as NULL
    const insertRes = await c.query(`
        INSERT INTO public.iebc_offices (
            county,
            constituency,
            constituency_name,
            office_location,
            clean_office_location,
            ward,
            centre_code,
            latitude,
            longitude,
            geocode_confidence,
            geocode_method,
            geocode_status,
            verified,
            notes,
            source,
            result_type,
            returning_officer_name,
            returning_officer_email,
            office_type,
            category,
            created_at,
            updated_at,
            landmark_type,
            landmark_subtype
        )
        SELECT
            rc.county,
            rc.constituency,
            rc.constituency                                             AS constituency_name,
            rc.name                                                     AS office_location,
            rc.raw_text                                                 AS clean_office_location,
            rc.ward,
            rc.centre_code,
            CASE WHEN rc.latitude  IS NOT NULL AND rc.latitude  != 0 THEN rc.latitude  ELSE NULL END,
            CASE WHEN rc.longitude IS NOT NULL AND rc.longitude != 0 THEN rc.longitude ELSE NULL END,
            rc.geocode_confidence,
            rc.location_source                                          AS geocode_method,
            rc.location_type                                            AS geocode_status,
            CASE WHEN rc.latitude IS NOT NULL AND rc.latitude != 0 THEN TRUE ELSE FALSE END AS verified,
            rc.raw_text                                                 AS notes,
            'iebc_registration_centres'                                 AS source,
            rc.location_type                                            AS result_type,
            rc.returning_officer_name,
            rc.returning_officer_email,
            'REGISTRATION_CENTRE'                                       AS office_type,
            'registration_centre'                                       AS category,
            rc.created_at,
            rc.updated_at,
            'Building'                                                  AS landmark_type,
            'Registration Centre'                                       AS landmark_subtype
        FROM public.iebc_registration_centres rc
        RETURNING id
    `);

    log(`[PHASE C] Inserted ${insertRes.rowCount} rows into iebc_offices.`);

    // Update geom column for all rows that have coordinates
    const geomRes = await c.query(`
        UPDATE public.iebc_offices
        SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `);
    log(`[PHASE C] Updated geom for ${geomRes.rowCount} rows.`);

    // Link returning_officer.office_id back to new iebc_offices rows
    const linkRes = await c.query(`
        UPDATE public.returning_officer ro
        SET office_id = io.id
        FROM public.iebc_offices io
        WHERE ro.constituency = io.constituency
          AND ro.name = io.returning_officer_name
          AND ro.office_id IS NULL
    `);
    log(`[PHASE C] Linked ${linkRes.rowCount} returning_officer records to new iebc_offices IDs.`);
}

// ─── PHASE D: Report NULL-coord rows for v14.4 geocoding ────────────────────
async function phaseD(c) {
    log('=== PHASE D: Queuing NULL-coord rows for geocoding ===');

    const nullRes = await c.query(`
        SELECT count(*) as total_null
        FROM public.iebc_offices
        WHERE latitude IS NULL OR longitude IS NULL
    `);
    const totalNull = parseInt(nullRes.rows[0].total_null);

    // Write a cursor file for the master scraper to pick up starting from 0, null-coords only
    const cursorFile = path.resolve(__dirname, '../data/cursor_master_iebc_offices_nullonly.json');
    fs.writeFileSync(cursorFile, JSON.stringify({ totalProcessed: 0, totalResolved: 0, nullCoordsOnly: true }, null, 2));

    log(`[PHASE D] ${totalNull} rows have NULL coordinates — cursor file written for v14.4 geocoding.`);
    log(`[PHASE D] Launch command: npx ts-node scraper/google_maps_scraper_master.ts iebc_offices --null-only`);
}

// ─── PHASE E: Summary for concurrent enrichment ──────────────────────────────
async function phaseE(c) {
    log('=== PHASE E: Enrichment Readiness Summary ===');

    const summary = await c.query(`
        SELECT 
            count(*)                                                      AS total_rows,
            count(*) FILTER (WHERE latitude IS NOT NULL)                  AS with_coords,
            count(*) FILTER (WHERE latitude IS NULL)                      AS missing_coords,
            count(*) FILTER (WHERE returning_officer_name IS NOT NULL)    AS with_ro,
            count(*) FILTER (WHERE elevation_meters IS NOT NULL)          AS with_elevation,
            count(*) FILTER (WHERE landmark IS NOT NULL)                  AS with_landmark
        FROM public.iebc_offices
    `);
    const s = summary.rows[0];
    log(`[PHASE E] Summary:`);
    log(`          Total rows:      ${s.total_rows}`);
    log(`          With coords:     ${s.with_coords}`);
    log(`          Missing coords:  ${s.missing_coords}`);
    log(`          With RO:         ${s.with_ro}`);
    log(`          With elevation:  ${s.with_elevation} (→ run resolve_coordinates.py)`);
    log(`          With landmark:   ${s.with_landmark} (→ run google_maps_scraper_master.ts)`);
    log(`\n[PHASE E] Concurrent enrichment commands:`);
    log(`  1) npx ts-node scraper/google_maps_scraper_master.ts iebc_offices --null-only`);
    log(`  2) python scripts/resolve_coordinates.py --table iebc_offices --batch 200`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    log('=======================================================');
    log('  Nasaka IEBC Offices Rebuild — v21.0');
    log(`  Started: ${new Date().toISOString()}`);
    log('=======================================================');

    const c = await getClient();

    try {
        await phaseA(c);
        await phaseB(c);
        await phaseC(c);
        await phaseD(c);
        await phaseE(c);
        log('\n[DONE] All phases completed successfully.');
    } catch (err) {
        log(`[ERROR] ${err.message}`);
        log(err.stack);
        process.exitCode = 1;
    } finally {
        await c.end();
        flushLog();
        log(`[LOG] Written to ${LOG_FILE}`);
    }
}

main();
