import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

// Construct DIRECT connection string (Non-pooled)
// postgres://postgres:[password]@db.ftswzvqwxdwgkvfbwfpx.supabase.co:5432/postgres
const dbPassword = "1268Saem'sTunes!";
// Using Session Pooler on 5432 as fallback for Direct Host
const poolerUrl = `postgresql://postgres.ftswzvqwxdwgkvfbwfpx:${encodeURIComponent(dbPassword)}@aws-0-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require`;

async function prep() {
    const client = new Client({ 
        connectionString: poolerUrl,
        connectionTimeoutMillis: 30000,
        statement_timeout: 60000 
    });

    console.log('[POOLER-PREP] Connecting to Session Pooler (5432)...');
    try {
        await client.connect();
        console.log('[DIRECT-PREP] Connected.');

        console.log('  Adding RO columns...');
        await client.query('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS returning_officer_name TEXT');
        await client.query('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS returning_officer_email TEXT');
        await client.query('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS raw_scrape_text TEXT');
        await client.query('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS mapping_uuid UUID');
        
        console.log('  Cleansing...');
        await client.query("DELETE FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'");
        
        console.log('[DIRECT-PREP] SUCCESS.');
    } catch (e: any) {
        console.error('[DIRECT-PREP ERROR]', e.message);
    } finally {
        await client.end();
    }
}

prep();
