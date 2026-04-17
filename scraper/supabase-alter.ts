/**
 * supabase-alter.ts
 * 
 * Uses the Supabase project REST API to execute ALTER TABLE
 * statements directly against the database, bypassing PgBouncer.
 * The Supabase REST API has no statement_timeout restriction.
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('[FATAL] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    process.exit(1);
}

async function execRPC(sql: string, label: string): Promise<boolean> {
    try {
        // Use the Supabase postgrest RPC or direct SQL via the /rest/v1/rpc endpoint
        // Actually, we'll use the pg_net or direct fetch approach
        // The simplest: use supabase-js with a raw SQL function if one exists,
        // or call the Management API

        // Method: Direct SQL via Supabase Management API
        const projectRef = SUPABASE_URL!.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
        if (!projectRef) {
            console.error('[FATAL] Cannot extract project ref from URL');
            return false;
        }

        // Try using the /rest/v1/ endpoint to call a custom function
        // Since we can't run raw SQL via REST, we'll use a different approach:
        // Execute via the supabase-js client using rpc
        
        // Alternative: Use the pg client but with a direct (non-pooler) connection
        // The non-pooler connection string uses port 5432 instead of 6543
        const { Client } = require('pg');
        const directUrl = process.env.SUPABASE_DB_POOLED_URL!
            .replace(':6543/', ':5432/')  // Switch from pooler to direct
            .replace('.pooler.supabase.com', '.supabase.com'); // Remove pooler prefix
        
        console.log(`  [${label}] Using direct connection...`);
        const client = new Client({ 
            connectionString: directUrl,
            connectionTimeoutMillis: 30000,
            statement_timeout: 300000 // 5 minutes
        });
        
        await client.connect();
        await client.query(sql);
        await client.end();
        console.log(`  ✓ ${label}`);
        return true;
    } catch (e: any) {
        console.error(`  ✗ ${label}: ${e.message}`);
        
        // Fallback: try with pooled but smaller operation
        try {
            const { Client } = require('pg');
            const client = new Client({ connectionString: process.env.SUPABASE_DB_POOLED_URL });
            await client.connect();
            // Check if column already exists first
            const colMatch = sql.match(/IF NOT EXISTS (\w+)/);
            if (colMatch) {
                const check = await client.query(`
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema='public' AND table_name='iebc_offices' AND column_name=$1
                `, [colMatch[1]]);
                if (check.rows.length > 0) {
                    console.log(`  → ${colMatch[1]} already exists (confirmed via info_schema).`);
                    await client.end();
                    return true;
                }
            }
            await client.end();
        } catch (_) {}
        
        return false;
    }
}

async function main() {
    console.log('[ALTER] Adding columns to iebc_offices via direct connection...\n');
    
    const stmts: [string, string][] = [
        ['ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS returning_officer_name TEXT', 'returning_officer_name'],
        ['ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS returning_officer_email TEXT', 'returning_officer_email'],
        ['ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS raw_scrape_text TEXT', 'raw_scrape_text'],
        ['ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS mapping_uuid UUID', 'mapping_uuid'],
    ];

    let allOk = true;
    for (const [sql, label] of stmts) {
        const ok = await execRPC(sql, label);
        if (!ok) allOk = false;
    }

    if (allOk) {
        console.log('\n[ALTER] All columns added/confirmed. Ready for ingest.');
    } else {
        console.log('\n[ALTER] Some columns could not be added.');
        console.log('[ALTER] MANUAL FALLBACK: Run these in Supabase SQL Editor:');
        for (const [sql] of stmts) {
            console.log(`  ${sql};`);
        }
    }
}

main();
