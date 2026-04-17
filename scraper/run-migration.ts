/**
 * run-migration.ts
 * Programmatically executes the Great Swap SQL migration.
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const dbUrl = process.env.SUPABASE_DB_POOLED_URL;

if (!dbUrl) {
  console.error('[ERROR] SUPABASE_DB_POOLED_URL not found in .env');
  process.exit(1);
}

async function runMigration() {
  const sqlPath = path.join(__dirname, '../supabase/migrations/20260417_the_great_swap.sql');
  console.log(`[MIGRATION] Reading SQL from: ${sqlPath}`);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({ connectionString: dbUrl });

  try {
    console.log('[MIGRATION] Attempting connection...');
    await client.connect();
    console.log('[MIGRATION] Connected. Starting transaction...');
    
    await client.query('BEGIN');
    console.log('[MIGRATION] Transaction started. Executing SQL...');
    await client.query(sql);
    console.log('[MIGRATION] SQL execution finished. Committing...');
    await client.query('COMMIT');
    
    console.log('[MIGRATION] SUCCESS: The Great Swap complete.');
    
    const res = await client.query('SELECT count(*) FROM public.iebc_offices');
    console.log(`[VERIFY] Total records in iebc_offices: ${res.rows[0].count}`);
    
  } catch (err: any) {
    console.error('[MIGRATION ERROR]', err);
    try { await client.query('ROLLBACK'); } catch (rErr) { console.error('[ROLLBACK ERROR]', rErr); }
  } finally {
    await client.end();
  }
}

runMigration();
