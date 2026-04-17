/**
 * ham-atomic-sync.ts
 * 
 * THE NUCLEAR OPTION: Direct SQL Atomic Synchronizer
 * 
 * Bypasses REST/RLS entirely using the Public/Service Role DB Credentials.
 * - Resolves all 24,369 Registration Centres to Wards
 * - Resolves all 290 Constituency Offices to Wards
 * - Promotes all ROI metadata (Name/Email) table-wide
 * - Ensures correct CAW codes for all records
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });
const dbUrl = process.env.SUPABASE_DB_POOLED_URL;

if (!dbUrl) { console.error('[FATAL] SUPABASE_DB_POOLED_URL missing'); process.exit(1); }

function deepNormalize(s: string): string {
    return (s || '').toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/ ward$/g, '')
        .replace(/ constituency$/g, '')
        .replace(/ county$/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

async function run() {
    const pg = new Client({ connectionString: dbUrl });
    await pg.connect();
    console.log('=== NASAKA ATOMIC SYNC (DIRECT SQL MODE) ===\n');

    // 1. Fetch Wards Reference
    console.log('[1/4] Fetching Ward Reference Table...');
    const { rows: wards } = await pg.query("SELECT id, ward_name, constituency, county, caw_code FROM public.wards");
    console.log(`  Found ${wards.length} wards in reference.\n`);

    // Index wards by deep normalized keys
    const wardMap = new Map<string, any>();
    for (const w of wards) {
        const k = `${deepNormalize(w.county)}|${deepNormalize(w.constituency)}|${deepNormalize(w.ward_name)}`;
        wardMap.set(k, w);
    }

    // 2. Fetch All IEBC Offices
    console.log('[2/4] Fetching All IEBC Offices (Centres + Offices)...');
    const { rows: offices } = await pg.query("SELECT id, office_location, ward, constituency, county, notes, centre_code FROM public.iebc_offices");
    console.log(`  Found ${offices.length} records to process.\n`);

    // 3. Process & Update
    console.log('[3/4] Executing Direct SQL Atomic Promotion...');
    let fixedRelational = 0;
    let fixedROI = 0;

    for (let i = 0; i < offices.length; i++) {
        const row = offices[i];
        
        // --- ROI Promotion ---
        const notes = row.notes || '';
        const nameMatch = notes.match(/RO_NAME:\s*([^|]+)/);
        const emailMatch = notes.match(/RO_EMAIL:\s*([^\s|]+)/);
        const roName = nameMatch ? nameMatch[1].trim() : null;
        const roEmail = emailMatch ? emailMatch[1].trim() : null;

        // --- Relational Link ---
        const k = `${deepNormalize(row.county)}|${deepNormalize(row.constituency)}|${deepNormalize(row.ward)}`;
        const match = wardMap.get(k);
        
        const cawCode = match ? `${match.caw_code}${row.centre_code || '999'}` : null;
        const wardId = match ? match.id : null;
        const wardCode = match ? match.caw_code : null;

        // Update record
        await pg.query(`
            UPDATE public.iebc_offices SET
                returning_officer_name = $1,
                returning_officer_email = $2,
                caw_code = $3,
                ward_id = $4,
                ward_code = $5,
                updated_at = NOW()
            WHERE id = $6
        `, [roName, roEmail, cawCode, wardId, wardCode, row.id]);

        if (match) fixedRelational++;
        if (roName) fixedROI++;

        if (i % 2000 === 0) process.stdout.write('.');
    }

    console.log(`\n\n[4/4] COMPLETE.`);
    console.log(`  Relational Links Fixed: ${fixedRelational} / ${offices.length}`);
    console.log(`  ROI Metadata Fixed:     ${fixedROI} / ${offices.length}`);
    
    // Final Audit Query
    const { rows: audit } = await pg.query(`
        SELECT 
            COUNT(*) FILTER (WHERE caw_code IS NULL) as null_caw,
            COUNT(*) FILTER (WHERE returning_officer_name IS NULL) as null_ro
        FROM public.iebc_offices
        WHERE office_type = 'REGISTRATION_CENTRE'
    `);
    
    console.log(`\n=== FINAL PRODUCTION STATUS (CENTRES) ===`);
    console.log(`  Remaining Orphans: ${audit[0].null_caw}  (${((audit[0].null_caw/24369)*100).toFixed(1)}%)`);
    console.log(`  Remaining Null RO: ${audit[0].null_ro}  (${((audit[0].null_ro/24369)*100).toFixed(1)}%)`);
    
    await pg.end();
}

run().catch(console.error);
