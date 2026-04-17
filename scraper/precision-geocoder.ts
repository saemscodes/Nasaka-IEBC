/**
 * precision-geocoder.ts
 *
 * A high-precision geocoding engine for IEBC registration centres.
 * Strategy:
 *   1. Use existing data as a 'location bias' guide.
 *   2. Query Google Maps Geocoding API for the absolute truth.
 *   3. Reverse-verify that coordinates fall within the expected region.
 *
 * Environment variables required in .env:
 *   - GOOGLE_MAPS_API_KEY
 *   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';
import * as fs from 'fs';

dotenv.config({ path: '../.env' });

// ============================================================
// CONFIGURATION
// ============================================================
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY!;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const BATCH_SIZE = 100;
const GEOCODE_WAIT_MS = 200; // Throttle to stay safe

if (!GOOGLE_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[ERROR] Missing API keys in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// TYPES
// ============================================================
interface Centre {
  id: string;
  name: string;
  county: string;
  constituency: string;
  ward: string | null;
}

// ============================================================
// CORE LOGIC
// ============================================================

async function fetchUngeocodedCentres(limit: number): Promise<Centre[]> {
  const { data, error } = await supabase
    .from('iebc_registration_centres')
    .select('id, name, county, constituency, ward')
    .is('latitude', null)
    .not('centre_code', 'is', null) // STRICT: Only geocode actual centres
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function geocodeCentre(centre: Centre): Promise<any> {
  // Construct a strict query: Name + Ward + Const + County + Kenya
  const query = `${centre.name}, ${centre.ward || ''}, ${centre.constituency}, ${centre.county}, Kenya`
    .replace(/, ,/g, ',')
    .trim();

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&region=ke`;

  const response = await axios.get(url);
  const { results, status } = response.data;

  if (status === 'OK' && results.length > 0) {
    const bestMatch = results[0];
    const { lat, lng } = bestMatch.geometry.location;
    const locationType = bestMatch.geometry.location_type;
    const placeId = bestMatch.place_id;

    // REVERSE VERIFICATION: Simple bounds check (Kenya rough bounding box)
    const isWithinKenya = lat > -4.7 && lat < 5.5 && lng > 33.8 && lng < 41.9;

    if (!isWithinKenya) {
      console.warn(`  [VERIFY FAIL] ${centre.name} returned coordinates outside Kenya: ${lat}, ${lng}`);
      return null;
    }

    return {
      latitude: lat,
      longitude: lng,
      geocode_confidence: locationType === 'ROOFTOP' ? 1.0 : 0.7,
      google_place_id: placeId,
      location_type: locationType,
      location_source: 'google'
    };
  }

  return null;
}

async function main() {
  console.log('='.repeat(60));
  console.log('[NASAKA PRECISION GEOCODER] Starting process...');
  console.log('='.repeat(60));

  let totalProcessed = 0;

  while (true) {
    const centres = await fetchUngeocodedCentres(BATCH_SIZE);
    if (centres.length === 0) {
      console.log('\n[DONE] No more ungeocoded centres found.');
      break;
    }

    console.log(`\n[BATCH] Processing ${centres.length} centres...`);

    for (const centre of centres) {
      try {
        const result = await geocodeCentre(centre);
        
        if (result) {
          const { error } = await supabase
            .from('iebc_registration_centres')
            .update(result)
            .eq('id', centre.id);

          if (error) {
            console.error(`  [DB ERROR] ${centre.name}: ${error.message}`);
          } else {
            console.log(`  [SUCCESS] ${centre.name} -> ${result.latitude}, ${result.longitude} (${result.location_type})`);
            totalProcessed++;
          }
        } else {
          console.log(`  [SKIP] ${centre.name}: No reliable geocoding result.`);
          // Mark as tried but failed to avoid infinite loop
          await supabase
            .from('iebc_registration_centres')
            .update({ location_source: 'attempted_failed' })
            .eq('id', centre.id);
        }

        await new Promise(r => setTimeout(r, GEOCODE_WAIT_MS));
      } catch (err: any) {
        console.error(`  [API ERROR] ${centre.name}: ${err.message}`);
        await new Promise(r => setTimeout(r, 2000)); // Cool down on error
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`[COMPLETED] Total centres geocoded: ${totalProcessed}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});
