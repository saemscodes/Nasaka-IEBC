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
    const r = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='returning_officer' ORDER BY ordinal_position`);
    console.log('returning_officer columns:', r.rows.map(x => x.column_name + '|' + x.data_type).join('\n'));
    const s = await c.query(`SELECT * FROM public.returning_officer LIMIT 2`);
    console.log('Sample:', JSON.stringify(s.rows, null, 2));
    const cnt = await c.query(`SELECT count(*) FROM public.returning_officer`);
    console.log('Count:', cnt.rows[0].count);
    await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
