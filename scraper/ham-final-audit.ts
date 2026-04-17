import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });
const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function audit() {
    console.log('=== NASAKA HAM MODE — FULL PRODUCTION AUDIT ===\n');

    // 1. Row Counts
    const [{ count: total }, { count: orphans }, { count: geocoded }, { count: pending }, { count: roName }, { count: roEmail }] = await Promise.all([
        s.from('iebc_offices').select('*',{count:'exact',head:true}).eq('office_type','REGISTRATION_CENTRE'),
        s.from('iebc_offices').select('*',{count:'exact',head:true}).eq('office_type','REGISTRATION_CENTRE').is('caw_code',null),
        s.from('iebc_offices').select('*',{count:'exact',head:true}).eq('office_type','REGISTRATION_CENTRE').eq('geocode_status','verified'),
        s.from('iebc_offices').select('*',{count:'exact',head:true}).eq('office_type','REGISTRATION_CENTRE').eq('geocode_status','pending'),
        s.from('iebc_offices').select('*',{count:'exact',head:true}).eq('office_type','REGISTRATION_CENTRE').not('returning_officer_name','is',null),
        s.from('iebc_offices').select('*',{count:'exact',head:true}).eq('office_type','REGISTRATION_CENTRE').not('returning_officer_email','is',null),
    ]);

    console.log('[1] DATA INTEGRITY');
    console.log(`  Total Centres:         ${total}`);
    console.log(`  Orphans (no caw_code): ${orphans}  (${((Number(orphans)/Number(total))*100).toFixed(1)}%)`);
    console.log(`  Linked Centres:        ${Number(total)-Number(orphans)}  (${(((Number(total)-Number(orphans))/Number(total))*100).toFixed(1)}%)\n`);

    console.log('[2] RETURNING OFFICER METADATA');
    console.log(`  Has RO Name:           ${roName}  (${((Number(roName)/Number(total))*100).toFixed(1)}%)`);
    console.log(`  Has RO Email:          ${roEmail}  (${((Number(roEmail)/Number(total))*100).toFixed(1)}%)\n`);

    console.log('[3] GEOCODING READINESS');
    console.log(`  Geocoded (verified):   ${geocoded}`);
    console.log(`  Pending:               ${pending}`);
    console.log(`  Ready to geocode:      ${pending} records\n`);

    // 2. Sample RO Card Data
    const { data: sampleRO } = await s.from('iebc_offices')
        .select('id, office_location, ward, constituency, county, returning_officer_name, returning_officer_email, caw_code, geocode_status')
        .eq('office_type','REGISTRATION_CENTRE')
        .not('returning_officer_name','is',null)
        .not('caw_code','is',null)
        .limit(5);

    console.log('[4] SAMPLE LINKED + RO RECORDS (Production Quality Check)');
    for (const r of (sampleRO||[])) {
        console.log(`  [${r.id}] ${r.office_location}`);
        console.log(`    Ward: ${r.ward} | Cons: ${r.constituency} | County: ${r.county}`);
        console.log(`    RO:   ${r.returning_officer_name} <${r.returning_officer_email}>`);
        console.log(`    CawCode: ${r.caw_code} | GeocodeStatus: ${r.geocode_status}`);
        console.log('');
    }

    // 3. Orphan constituency breakdown
    const { data: orphanConsts } = await s.from('iebc_offices')
        .select('constituency,county')
        .eq('office_type','REGISTRATION_CENTRE')
        .is('caw_code',null)
        .limit(2000);
    
    const distMap: Record<string,number> = {};
    for (const o of (orphanConsts||[])) {
        const k = `${o.constituency}`;
        distMap[k] = (distMap[k]||0)+1;
    }
    const top10 = Object.entries(distMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
    
    console.log('[5] TOP ORPHAN CONSTITUENCIES (Ward/Constituency naming failures)');
    for (const [cons, cnt] of top10) {
        console.log(`  ${cons}: ${cnt} orphans`);
    }

    // 4. Ward reference table check
    const { data: wards } = await s.from('wards').select('constituency');
    const uniqueConsts = new Set(wards?.map((w:any) => w.constituency.toLowerCase().trim())).size;
    console.log(`\n[6] Ward Reference Table: ${uniqueConsts} unique constituencies out of 290 expected`);
}

audit().catch(console.error);
