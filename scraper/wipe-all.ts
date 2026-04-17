/**
 * wipe-all.ts
 * Wipes the database and the log file for a fresh start.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const LOG_FILE = './scraper-log.json';

async function wipe() {
  console.log('[WIPE] Truncating table via Direct Postgres...');
  const pgClient = new Client({ connectionString: process.env.SUPABASE_DB_POOLED_URL });
  
  try {
    await pgClient.connect();
    await pgClient.query('TRUNCATE public.iebc_registration_centres RESTART IDENTITY;');
    console.log('[WIPE] Database truncated (RESTART IDENTITY).');
  } catch (err) {
    console.error('[WIPE ERROR]', (err as Error).message);
  } finally {
    await pgClient.end();
  }

  if (fs.existsSync(LOG_FILE)) {
    fs.unlinkSync(LOG_FILE);
    console.log('[WIPE] Scraper log deleted.');
  }

  console.log('[WIPE] Done.');
}

wipe();
