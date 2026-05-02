/**
 * schema_audit.cjs
 * Reads full schemas of both iebc tables and any existing returning_officer table
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

    const tables = ['iebc_offices', 'iebc_registration_centres', 'returning_officer'];
    for (const tbl of tables) {
        const r = await c.query(`
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_schema='public' AND table_name=$1 
            ORDER BY ordinal_position
        `, [tbl]);
        if (r.rows.length === 0) { console.log(`\n=== ${tbl}: TABLE DOES NOT EXIST ===`); continue; }
        console.log(`\n=== ${tbl} (${r.rows.length} columns) ===`);
        r.rows.forEach(row => console.log(`  ${row.column_name.padEnd(35)} | ${row.data_type.padEnd(20)} | nullable: ${row.is_nullable}`));
    }

    // Row counts
    for (const tbl of ['iebc_offices', 'iebc_registration_centres']) {
        const r = await c.query(`SELECT count(*) FROM public.${tbl}`);
        console.log(`\n[COUNT] ${tbl}: ${r.rows[0].count} rows`);
    }

    // Returning officers in iebc_offices
    const ro = await c.query(`
        SELECT count(*) as total, 
               count(returning_officer_name) as with_name,
               count(returning_officer_email) as with_email
        FROM public.iebc_offices
    `);
    console.log('\n[RO DATA IN iebc_offices]');
    console.log(`  Total rows: ${ro.rows[0].total}, With name: ${ro.rows[0].with_name}, With email: ${ro.rows[0].with_email}`);

    // FK constraints on iebc_offices
    const fk = await c.query(`
        SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name='iebc_offices' AND tc.constraint_type IN ('FOREIGN KEY','PRIMARY KEY')
    `);
    console.log('\n[CONSTRAINTS on iebc_offices]');
    fk.rows.forEach(row => console.log(`  ${row.constraint_name}: ${row.column_name} -> ${row.foreign_table || '(PK)'}`));

    await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
