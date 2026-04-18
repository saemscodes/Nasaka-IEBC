import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function check() {
    const pg = new Client({ connectionString: process.env.SUPABASE_DB_POOLED_URL });
    await pg.connect();
    
    // Check tables
    const tRes = await pg.query(`SELECT table_name FROM information_schema.tables WHERE table_name ILIKE '%ward%'`);
    console.log("Tables with 'ward':", tRes.rows.map(r => r.table_name));

    // Check columns of wards
    const cRes = await pg.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'wards'`);
    console.log("Wards columns:", cRes.rows);
    
    // If ward_boundaries exist:
    const wbRes = await pg.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ward_boundaries'`);
    console.log("Ward Boundaries columns:", wbRes.rows);

    await pg.end();
}
check().catch(console.error);
