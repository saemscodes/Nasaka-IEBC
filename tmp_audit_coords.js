import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkCoordinates() {
  const { data, error } = await supabase
    .from('iebc_offices')
    .select('id, latitude, longitude, county')
    .limit(10);

  if (error) {
    console.error('Error fetching offices:', error);
    return;
  }

  console.log('--- Coordinate Audit (10 Samples) ---');
  data.forEach(office => {
    const latValid = office.latitude >= -4.7 && office.latitude <= 5.5;
    const lngValid = office.longitude >= 33.9 && office.longitude <= 41.9;
    console.log(`ID: ${office.id} | County: ${office.county} | Lat: ${office.latitude} (${latValid ? 'OK' : 'SWAPPED?'}) | Lng: ${office.longitude} (${lngValid ? 'OK' : 'SWAPPED?'})`);
  });
}

checkCoordinates();
