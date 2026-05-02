import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getPreposition(distM: number): string {
  if (distM < 5) return "at";
  if (distM < 50) return "opposite";
  if (distM < 150) return "next to";
  return "near";
}

function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2 * (Math.PI / 180));
  const x = Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
            Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos(dLon);
  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  return (bearing + 360) % 360;
}

function getCardinal(bearing: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(bearing / 45) % 8;
  return dirs[idx];
}

async function runHamiltonian() {
  console.log("--- PHASE 2: SPATIAL LANDMARK INFERENCE (FORCE MVITA) ---");

  // Fetch Mvita first
  const { data: offices, error: e1 } = await supabase
    .from('iebc_offices')
    .select('id, clean_office_location, latitude, longitude, county, ward, constituency_name')
    .eq('constituency_name', 'MVITA')
    .not('latitude', 'is', null)
    .limit(20);

  if (e1) {
    console.error("Error fetching offices:", e1);
    return;
  }

  if (!offices || offices.length === 0) {
    console.log("No geocoded Mvita offices found.");
    return;
  }

  for (const office of offices) {
    const { id, clean_office_location, latitude: lat, longitude: lon, ward, constituency_name: consti } = office;
    
    // Spatial Join via RPC (we need an rpc for nearest landmark if possible, 
    // or just use map_landmarks search via direct query if PostgREST allows it)
    // Since map_landmarks is a separate table, we'll use a direct SQL via the pooled URL inside this script 
    // or just use another psql call for individual records if performance permits.
    // BETTER: Use a single SQL query in psql that does the HAM format.
    
    console.log(`Processing ID ${id} (${clean_office_location})...`);
    // I will use PG via a simpler approach for now to ensure I get the strings.
  }
}

// User's Direct SQL approach is actually BEST for bulk. 1 Turn.
// Let's create the High-Fidelity SQL.
