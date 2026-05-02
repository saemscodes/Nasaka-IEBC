const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const c = new Client({ connectionString: process.env.SUPABASE_DB_POOLED_URL });

(async () => {
  await c.connect();

  // Full columns list
  const r1 = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'iebc_offices' ORDER BY ordinal_position");
  for (const row of r1.rows) console.log('  col:', row.column_name);

  // Sample RC row from iebc_offices
  const r2 = await c.query("SELECT * FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' LIMIT 1");
  console.log('\nSample iebc_offices RC:', JSON.stringify(r2.rows[0], null, 2));

  // Clustered in REGISTRATION CENTRES table directly
  const r3 = await c.query(`SELECT count(*) FROM (
    SELECT rc.id FROM public.iebc_registration_centres rc
    JOIN (
      SELECT latitude, longitude FROM public.iebc_registration_centres
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      GROUP BY latitude, longitude HAVING count(*) >= 3
    ) c ON rc.latitude = c.latitude AND rc.longitude = c.longitude
  ) x`);
  console.log('\nClustered in RC table (3+):', r3.rows[0].count);

  // Sample RC table rows
  const r4 = await c.query("SELECT * FROM public.iebc_registration_centres LIMIT 1");
  console.log('\nSample RC:', JSON.stringify(r4.rows[0], null, 2));

  await c.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
