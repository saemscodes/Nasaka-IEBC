import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const dbPassword = "1268Saem'sTunes!";
const poolerUrl = `postgresql://postgres.ftswzvqwxdwgkvfbwfpx:${encodeURIComponent(dbPassword)}@aws-0-eu-north-1.pooler.supabase.com:6543/postgres?sslmode=require`;

async function runPulse(sql: string) {
    const client = new Client({ 
        connectionString: poolerUrl,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        await client.query(sql);
        console.log(`✓ SUCCESS: ${sql}`);
    } catch (e: any) {
        console.error(`✗ FAILED: ${sql} - ${e.message}`);
    } finally {
        await client.end();
    }
}

async function main() {
    console.log('[PULSE-DDL] Starting surgical schema updates...');
    await runPulse('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS returning_officer_name TEXT');
    await runPulse('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS returning_officer_email TEXT');
    await runPulse('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS raw_scrape_text TEXT');
    await runPulse('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS mapping_uuid UUID');
    await runPulse("DELETE FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'");
}

main();
