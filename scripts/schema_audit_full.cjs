/**
 * schema_audit_full.cjs
 * Full column-by-column schema dump for migration planning
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadDotEnv() {
    const envPath = path.resolve(__dirname, '../.env');
    if (!fs.existsSync(envPath)) return;
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) return;
        const key = line.slice(0, eqIdx).trim();
        const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (key) process.env[key] = val;
    });
}
loadDotEnv();

async function main() {
    const c = new Client({ connectionString: process.env.SUPABASE_DB_POOLED_URL });
    await c.connect();

    for (const tbl of ['iebc_offices', 'iebc_registration_centres']) {
        const r = await c.query(
            `SELECT column_name, data_type, is_nullable, column_default 
             FROM information_schema.columns 
             WHERE table_schema='public' AND table_name=$1 
             ORDER BY ordinal_position`, [tbl]);
        console.log(`\n=== ${tbl} ===`);
        r.rows.forEach(row => console.log(JSON.stringify(row)));
    }

    // Sample row from each
    const s1 = await c.query(`SELECT * FROM public.iebc_offices LIMIT 1`);
    console.log('\n[SAMPLE iebc_offices row keys]:', Object.keys(s1.rows[0] || {}).join(', '));

    const s2 = await c.query(`SELECT * FROM public.iebc_registration_centres LIMIT 1`);
    console.log('[SAMPLE iebc_registration_centres row keys]:', Object.keys(s2.rows[0] || {}).join(', '));

    // RO data coverage
    const ro = await c.query(`
        SELECT count(*) as total, 
               count(returning_officer_name) as with_name,
               count(returning_officer_email) as with_email
        FROM public.iebc_offices WHERE returning_officer_name IS NOT NULL`);
    console.log('\n[RO COVERAGE in iebc_offices]:', JSON.stringify(ro.rows[0]));

    const rc_ro = await c.query(`
        SELECT count(*) as total, 
               count(returning_officer_name) as with_name,
               count(returning_officer_email) as with_email
        FROM public.iebc_registration_centres WHERE returning_officer_name IS NOT NULL`);
    console.log('[RO COVERAGE in iebc_registration_centres]:', JSON.stringify(rc_ro.rows[0]));

    await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
