import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

async function check() {
    const client = new Client({ connectionString: process.env.SUPABASE_DB_POOLED_URL });
    await client.connect();

    // 1. Check centre_code in registration centres
    const rcResult = await client.query('SELECT count(*) FROM public.iebc_registration_centres WHERE centre_code IS NOT NULL');
    console.log(`[RC] Non-null centre_codes: ${rcResult.rows[0].count}`);

    // 2. Check administrative mappings
    const counties = await client.query('SELECT count(*) FROM public.counties');
    console.log(`[ADM] Counties: ${counties.rows[0].count}`);

    const constituencies = await client.query('SELECT count(*) FROM public.constituencies');
    console.log(`[ADM] Constituencies: ${constituencies.rows[0].count}`);

    const wards = await client.query('SELECT count(*) FROM public.wards');
    console.log(`[ADM] Wards: ${wards.rows[0].count}`);

    await client.end();
}

check().catch(console.error);
