/**
 * resilient-migrate.ts (v7 - REST Resilient)
 * 
 * Strategy:
 * 1. Uses Supabase Client (HTTP/REST) for 100% resilience against socket resets.
 * 2. Fetches source data from iebc_registration_centres.
 * 3. Fetches administrative codes (Counties, constituencies, wards).
 * 4. Maps everything into iebc_offices.
 * 5. Uses individual or small batch RPC/REST calls for stability.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function surgicalPurge() {
    console.log('[MIGRATION] Step 0: Surgical Dependency-Aware Purge...');
    
    // Select all centres we want to clear
    const { data: targets } = await supabase
        .from('iebc_offices')
        .select('id')
        .eq('office_type', 'REGISTRATION_CENTRE')
        .limit(100000);

    if (!targets || targets.length === 0) {
        console.log('  ✓ Registry already clean.');
        return;
    }

    const ids = targets.map(t => t.id);
    console.log(`  [PURGE] Found ${ids.length} centres to clear.`);

    // 1. Identify dependent contributions
    const { data: contribs } = await supabase
        .from('iebc_office_contributions')
        .select('id')
        .in('original_office_id', ids);

    const cIds = (contribs || []).map(c => c.id);

    if (cIds.length > 0) {
        console.log(`  [PURGE] Clearing ${cIds.length} dependent contributions...`);
        const batchSize = 500;
        for (let i = 0; i < cIds.length; i += batchSize) {
            const batch = cIds.slice(i, i + batchSize);
            await supabase.from('contribution_archive').delete().in('contribution_id', batch);
            await supabase.from('iebc_office_contributions').delete().in('id', batch);
        }
    }

    // 2. Clear offices in chunks
    const batchSize = 1000;
    for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const { error } = await supabase.from('iebc_offices').delete().in('id', batch);
        if (error) console.error('\n  [PURGE ERROR]', error.message);
        process.stdout.write(`  [PURGE] Deleted ${i + batch.length}/${ids.length} centres...\r`);
    }
    console.log('\n  ✓ Surgical Purge Complete.');
}

async function main() {
    console.log('[MIGRATION] Starting Resilient REST Migration (v7.2-Surgical)...\n');

    // Fresh start requested: surgically clear registration centres while keeping legacy data
    await surgicalPurge();

    // 1. Fetch Source Data (Paginated)
    console.log('[1/4] Fetching source capture (Paginated)...');
    let sourceData: any[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('iebc_registration_centres')
            .select('*')
            .range(from, from + 999);
        
        if (error || !data) {
            console.error('[FATAL] Source data fetch failed:', error?.message);
            return;
        }
        sourceData = sourceData.concat(data);
        if (data.length < 1000) break;
        from += 1000;
        process.stdout.write(`  ✓ Fetched ${sourceData.length} records\r`);
    }
    console.log(`\n  ✓ Total Source Size: ${sourceData.length}\n`);

    // 2. Fetch Ref Data for Mapping
    console.log('[2/4] Fetching administrative reference codes...');
    const [{ data: counties }, { data: consts }, { data: wards }] = await Promise.all([
        supabase.from('counties').select('name, county_code'),
        supabase.from('constituencies').select('name, constituency_code'),
        supabase.from('wards').select('ward_name, constituency, caw_code, id')
    ]);

    const findCountyCode = (name: string) => counties?.find(c => c.name?.toLowerCase().trim() === (name || '').toLowerCase().trim())?.county_code;
    const findConstCode = (name: string) => consts?.find(c => c.name?.toLowerCase().trim() === (name || '').toLowerCase().trim())?.constituency_code;
    const findWardRef = (ward: string, cons: string) => wards?.find(w => 
        (w.ward_name || '').toLowerCase().trim() === (ward || '').toLowerCase().trim() && 
        (w.constituency || '').toLowerCase().trim() === (cons || '').toLowerCase().trim()
    );

    // 2b. Resumption Logic: Check existing caw_codes
    console.log('[2b/4] Checking current production progress (Resumption via caw_code)...');
    const { data: existingRecords } = await supabase
        .from('iebc_offices')
        .select('caw_code')
        .not('caw_code', 'is', null);
    
    const existingCaws = new Set((existingRecords || []).map(r => r.caw_code));
    console.log(`  ✓ Found ${existingCaws.size} already synced records.`);

    // 3. Process & Ingest
    console.log('[3/4] Ingesting in chunks of 100 (REST Upsert)...');
    
    sourceData.sort((a, b) => {
        const c1 = (a.county || '').localeCompare(b.county || '');
        if (c1 !== 0) return c1;
        const c2 = (a.constituency || '').localeCompare(b.constituency || '');
        if (c2 !== 0) return c2;
        const c3 = (a.ward || '').localeCompare(b.ward || '');
        if (c3 !== 0) return c3;
        return (a.name || '').localeCompare(b.name || '');
    });

    let currentWard = '';
    let codeCounter = 1;
    let totalIngested = 0;
    let skipped = 0;
    const BATCH_SIZE = 100;
    let batch: any[] = [];

    for (let i = 0; i < sourceData.length; i++) {
        const item = sourceData[i];
        const wardKey = `${item.county}|${item.constituency}|${item.ward}`;

        if (wardKey !== currentWard) {
            currentWard = wardKey;
            codeCounter = 1;
        }

        const centreCode = codeCounter.toString().padStart(3, '0');
        const wardRef = findWardRef(item.ward, item.constituency);
        const cawCode = wardRef?.caw_code ? `${wardRef.caw_code}${centreCode}` : null;
        codeCounter++;

        if (cawCode && existingCaws.has(cawCode)) {
            skipped++;
            continue;
        }

        const countyCode = findCountyCode(item.county);
        const constCode = findConstCode(item.constituency);

        // Map RO and Source ID into notes to avoid schema cache issues with new columns
        const metaNotes = `SOURCE_ID: ${item.id} | RO_NAME: ${item.returning_officer_name || 'N/A'} | RO_EMAIL: ${item.returning_officer_email || 'N/A'} | RAW: ${item.raw_text?.substring(0, 500)}`;

        batch.push({
            county: item.county,
            county_code: countyCode || null,
            constituency: item.constituency,
            constituency_name: item.constituency,
            constituency_code: constCode || 0,
            office_location: item.name,
            clean_office_location: item.name, 
            ward: item.ward,
            ward_code: wardRef?.caw_code || null,
            ward_id: wardRef?.id || null,
            centre_code: centreCode,
            caw_code: cawCode,
            office_type: 'REGISTRATION_CENTRE',
            category: 'registration_centre',
            source: 'IEBC_2026_PORTAL_SCRAPER',
            verified: true,
            geocode_status: 'pending',
            notes: metaNotes
        });

        if (batch.length >= BATCH_SIZE || i === sourceData.length - 1) {
            const { error } = await supabase.from('iebc_offices').upsert(batch, { 
                onConflict: 'centre_code, ward_code, constituency_code, county_code' 
            });
            
            if (error) {
                console.error(`\n[BATCH ERROR] offset ${i}:`, error.message);
                // If the constraint is hit or columns fail, we log but keep going
            } else {
                totalIngested += batch.length;
                process.stdout.write(`  ✓ Ingested ${totalIngested}/${sourceData.length} (Skipped: ${skipped})\r`);
            }
            batch = [];
        }
    }

    console.log(`\n\n[MIGRATION COMPLETE] Total Ingested: ${totalIngested}, Skipped: ${skipped}`);
}

main();
