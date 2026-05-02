/**
 * dump_columns.cjs – writes column lists to files for migration planning
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
            `SELECT column_name, data_type FROM information_schema.columns 
             WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [tbl]);
        const outFile = path.resolve(__dirname, `../data/${tbl}_columns.txt`);
        const content = r.rows.map(row => `${row.column_name}|${row.data_type}`).join('\n');
        fs.writeFileSync(outFile, content);
        console.log(`Written: ${outFile} (${r.rows.length} columns)`);
    }

    // sample rows
    const s1 = await c.query(`SELECT * FROM public.iebc_offices LIMIT 2`);
    fs.writeFileSync(path.resolve(__dirname, '../data/iebc_offices_sample.json'), JSON.stringify(s1.rows, null, 2));

    const s2 = await c.query(`SELECT * FROM public.iebc_registration_centres LIMIT 2`);
    fs.writeFileSync(path.resolve(__dirname, '../data/iebc_rc_sample.json'), JSON.stringify(s2.rows, null, 2));

    // RO coverage
    const ro1 = await c.query(`SELECT count(*) total, count(returning_officer_name) with_ro_name, count(returning_officer_email) with_ro_email FROM public.iebc_offices`);
    console.log('iebc_offices RO:', JSON.stringify(ro1.rows[0]));

    const ro2 = await c.query(`SELECT count(*) total, count(returning_officer_name) with_ro_name, count(returning_officer_email) with_ro_email FROM public.iebc_registration_centres`);
    console.log('iebc_registration_centres RO:', JSON.stringify(ro2.rows[0]));

    await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
