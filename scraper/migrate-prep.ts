import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

async function prep() {
    const client = new Client({ 
        connectionString: process.env.SUPABASE_DB_POOLED_URL,
        connectionTimeoutMillis: 30000,
        statement_timeout: 600000 // 10 minutes
    });

    console.log('[PREP] Connecting...');
    await client.connect();
    console.log('[PREP] Connected. Running Backup and Schema Aligns...');

    try {
        await client.query('BEGIN');
        
        // Backup
        await client.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'iebc_offices_legacy_backup') THEN
                    CREATE TABLE public.iebc_offices_legacy_backup AS SELECT * FROM public.iebc_offices;
                END IF;
            END $$;
        `);
        console.log('  ✓ Backup check complete.');

        // Columns
        await client.query('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS returning_officer_name TEXT');
        await client.query('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS returning_officer_email TEXT');
        await client.query('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS raw_scrape_text TEXT');
        await client.query('ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS mapping_uuid UUID');
        console.log('  ✓ Columns check complete.');

        // Cleanse
        await client.query("DELETE FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'");
        console.log('  ✓ Cleanse complete.');

        await client.query('COMMIT');
        console.log('[PREP] All prep phases complete.');
    } catch (e: any) {
        await client.query('ROLLBACK');
        console.error('[PREP ERROR]', e.message);
    } finally {
        await client.end();
    }
}

prep();
