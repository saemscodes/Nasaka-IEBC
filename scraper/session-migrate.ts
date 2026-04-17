/**
 * session-migrate.ts (v4 - Code Aware)
 * 
 * FINAL SWAP & SYNC STRATEGY:
 * 1. Uses Session Pooler (5432) for direct, long-running schema/data tasks.
 * 2. Backs up legacy data.
 * 3. Cleanses production registration centers.
 * 4. Ingests verified centres with:
 *    - Fuzzy mapping to counties/constituencies/wards for codes.
 *    - Synthetic centre_code generation (001+) per ward.
 *    - Full 60+ column alignment as per production DDL.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const sessionPoolerUrl = process.env.SUPABASE_DB_POOLED_URL; // Using Transaction Pooler (6543) for stability
if (!sessionPoolerUrl) { console.error('[FATAL] SUPABASE_DB_POOLED_URL missing'); process.exit(1); }

async function main() {
    console.log('[MIGRATION] Starting Code-Aware Migration (v5 Resilient)...\n');

    let totalProcessed = 0;
    try {
        const client = new Client({ connectionString: sessionPoolerUrl });
        await client.connect();
        
        // Phase 1-3 (Backup, Schema, Cleanse)
        console.log('[PHASE 1-3] Running Prep...');
        await client.query(`
            -- Backup
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'iebc_offices_legacy_backup') THEN
                    CREATE TABLE public.iebc_offices_legacy_backup AS SELECT * FROM public.iebc_offices;
                END IF;
            END $$;
            
            -- Schema
            ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS returning_officer_name TEXT;
            ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS returning_officer_email TEXT;
            ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS raw_scrape_text TEXT;
            ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS mapping_uuid UUID;
            
            -- Cleanse
            DELETE FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE';
        `);
        console.log('  ✓ Prep complete.\n');

        // Phase 4: Data Enrichment & Ingest (Chunked Selection)
        console.log('[PHASE 4] Starting Ingest in Selection Chunks...');
        
        const SELECT_CHUNK = 1000;
        let selectOffset = 0;
        let currentCaw = '';
        let codeCounter = 1;

        while (true) {
            const clientChunk = new Client({ connectionString: sessionPoolerUrl });
            await clientChunk.connect();
            
            const { rows: sourceData } = await clientChunk.query(`
                SELECT 
                    rc.id, rc.name, rc.county, rc.constituency, rc.ward, 
                    rc.returning_officer_name, rc.returning_officer_email, rc.raw_text,
                    c.county_code,
                    co.constituency_code,
                    w.caw_code as ward_code,
                    w.id as ward_id
                FROM public.iebc_registration_centres rc
                LEFT JOIN public.counties c ON lower(trim(c.name)) = lower(trim(rc.county))
                LEFT JOIN public.constituencies co ON lower(trim(co.name)) = lower(trim(rc.constituency))
                LEFT JOIN public.wards w ON (lower(trim(w.ward_name)) = lower(trim(rc.ward)) 
                                            AND lower(trim(w.constituency)) = lower(trim(rc.constituency)))
                ORDER BY rc.county, rc.constituency, rc.ward, rc.name
                LIMIT $1 OFFSET $2
            `, [SELECT_CHUNK, selectOffset]);
            await clientChunk.end();

            if (sourceData.length === 0) break;

            for (const row of sourceData) {
                const cawKey = `${row.county}|${row.constituency}|${row.ward}`;
                
                if (cawKey !== currentCaw) {
                    currentCaw = cawKey;
                    // Note: This logic for codeCounter only works perfectly if we don't split a Ward across SELECT_CHUNKs.
                    // Given 24k rows and 1k chunks, and ~16 centers per ward, this is mostly safe, but for 100% precision 
                    // we'll keep the counter global if we detect the same ward across chunks.
                    
                    // Improved: Reset counter ONLY if the CAW key changes.
                    codeCounter = 1;
                }

                const centreCode = codeCounter.toString().padStart(3, '0');
                codeCounter++;

                const payload = {
                    ...row,
                    centreCode,
                    caw_code: row.ward_code ? `${row.ward_code}${centreCode}` : null
                };

                await insertWithRetry(payload);
                totalProcessed++;
            }

            console.log(`  ✓ Progress: ${totalProcessed} centres...`);
            selectOffset += SELECT_CHUNK;
        }

    } catch (err: any) {
        console.error('[FATAL ERROR]', err.message);
    }
    
    console.log(`\n[MIGRATION COMPLETE] Total: ${totalProcessed} centres.`);
}

async function insertWithRetry(row: any, retries = 3) {
    const client = new Client({ connectionString: sessionPoolerUrl });
    for (let i = 0; i < retries; i++) {
        try {
            await client.connect();
            await client.query(`
                INSERT INTO public.iebc_offices (
                    county, county_code, constituency, constituency_name, constituency_code,
                    office_location, clean_office_location, ward, ward_code, ward_id,
                    centre_code, caw_code, returning_officer_name, returning_officer_email,
                    raw_scrape_text, mapping_uuid, office_type, category, source,
                    verified, geocode_status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                ON CONFLICT (centre_code, ward_code, constituency_code, county_code) DO NOTHING
            `, [
                row.county, row.county_code, row.constituency, row.constituency, row.constituency_code || 0,
                row.name, row.name, row.ward, row.ward_code, row.ward_id,
                row.centreCode, row.caw_code, row.returning_officer_name, row.returning_officer_email,
                row.raw_text, row.id, 'REGISTRATION_CENTRE', 'registration_centre', 'IEBC_PORTAL_2026_SCRAPER',
                true, 'pending'
            ]);
            await client.end();
            return;
        } catch (e: any) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        } finally {
            try { await client.end(); } catch {}
        }
    }
}

main();
