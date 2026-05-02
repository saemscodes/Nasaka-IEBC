const { Client } = require('./scraper/node_modules/pg');
const fs = require('fs');
const path = require('path');

// Load .env manually
const envPath = path.join(__dirname, '.env');
const lines = fs.readFileSync(envPath, 'utf8').split('\n');
for (const line of lines) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  const key = t.substring(0, eq).trim();
  let val = t.substring(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  process.env[key] = val;
}

const c = new Client({ connectionString: process.env.SUPABASE_DB_POOLED_URL });

(async () => {
  await c.connect();

  // 1. iebc_offices columns
  const r1 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'iebc_offices' ORDER BY ordinal_position");
  console.log('iebc_offices columns:', r1.rows.map(r => r.column_name).join(', '));

  // 2. count RC type offices
  const r2 = await c.query("SELECT count(*) as n FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'");
  console.log('RC offices in iebc_offices:', r2.rows[0].n);

  // 3. count RC table
  const r3 = await c.query("SELECT count(*) FROM public.iebc_registration_centres");
  console.log('RC table count:', r3.rows[0].count);

  // 4. sample iebc_offices RC row
  const r4 = await c.query("SELECT id, office_name, office_location, county, latitude, longitude FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' LIMIT 2");
  console.log('iebc_offices RC sample:', JSON.stringify(r4.rows, null, 2));

  // 5. sample RC table row
  const r5 = await c.query("SELECT id, name, county FROM public.iebc_registration_centres LIMIT 2");
  console.log('RC table sample:', JSON.stringify(r5.rows, null, 2));

  // 6. Check if there's a registration_centre_id FK
  const r6 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'iebc_offices' AND column_name LIKE '%registration%'");
  console.log('FK columns:', r6.rows.map(r => r.column_name).join(', '));

  // 7. id join test
  const r7 = await c.query("SELECT count(*) FROM public.iebc_offices io JOIN public.iebc_registration_centres rc ON io.id::text = rc.id::text WHERE io.office_type = 'REGISTRATION_CENTRE'");
  console.log('ID join count:', r7.rows[0].count);

  // 8. Count clustered
  const r8 = await c.query(`
    SELECT count(*) FROM (
      SELECT io.id FROM public.iebc_offices io 
      JOIN (
        SELECT latitude, longitude FROM public.iebc_offices 
        WHERE latitude IS NOT NULL 
        GROUP BY latitude, longitude 
        HAVING count(*) >= 3
      ) c ON io.latitude = c.latitude AND io.longitude = c.longitude
      WHERE io.office_type = 'REGISTRATION_CENTRE'
    ) x
  `);
  console.log('Clustered RC offices (3+):', r8.rows[0].count);

  // 9. Check if IDs in RC table appear directly in iebc_offices
  const r9 = await c.query("SELECT count(*) FROM public.iebc_registration_centres rc WHERE EXISTS (SELECT 1 FROM public.iebc_offices io WHERE io.id::text = rc.id::text)");
  console.log('RC IDs found in iebc_offices:', r9.rows[0].count);

  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
