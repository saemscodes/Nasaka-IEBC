/**
 * NASAKA GEOC-v15: Concurrent Re-Geocoding Pipeline for Clustered Centres
 * 
 * Architecture: A → (B + C) concurrent fallback
 *   A: google_maps_scraper_v14 — sync from iebc_registration_centres table
 *   B: precision_geocoding — spatial matching against map_landmarks / nearby POIs
 *   C: multi_source_crossvalidated — LocationIQ + OpenCage + Nominatim + Google Maps API
 * 
 * If A fails for a centre, B and C run concurrently. Best result wins.
 * 
 * Usage: node scripts/regeocode_clustered.cjs
 * 
 * ✊🏽🇰🇪
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── Load .env ───────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('[FATAL] .env file not found at', envPath);
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val.startsWith('${')) continue;
    process.env[key] = val;
  }
}
loadEnv();

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;
const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY;
const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const KENYA_BOUNDS = { minLat: -4.9, maxLat: 5.5, minLng: 33.5, maxLng: 42.0 };
function isInKenya(lat, lng) {
  return lat >= KENYA_BOUNDS.minLat && lat <= KENYA_BOUNDS.maxLat &&
         lng >= KENYA_BOUNDS.minLng && lng <= KENYA_BOUNDS.maxLng;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Nasaka-IEBC-GeocV15/1.0' }, timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// METHOD A: google_maps_scraper_v14 — Sync from iebc_registration_centres
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function loadRegistrationCentresLUT() {
  // Build a lookup table: normalize(name + county) → { lat, lng, confidence, source }
  const lut = new Map();
  let from = 0;
  const batchSize = 1000;
  let totalLoaded = 0;
  while (true) {
    const { data, error } = await supabase
      .from('iebc_registration_centres')
      .select('name, county, constituency, ward, latitude, longitude, geocode_confidence, location_source, google_place_id')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .range(from, from + batchSize - 1);
    if (error) { console.error('  RC fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    for (const rc of data) {
      const key = normalize(rc.name) + '||' + normalize(rc.county);
      // Only store if not already present, or if this has higher confidence
      if (!lut.has(key) || (rc.geocode_confidence && rc.geocode_confidence > (lut.get(key).confidence || 0))) {
        lut.set(key, {
          lat: rc.latitude, lng: rc.longitude,
          confidence: rc.geocode_confidence || 0.7,
          source: rc.location_source || 'google_maps_scraper_v14',
          address: `${rc.name}, ${rc.ward || ''}, ${rc.constituency || ''}, ${rc.county} County, Kenya`
        });
      }
    }
    totalLoaded += data.length;
    from += data.length;
    if (data.length < batchSize) break;
  }
  console.log('  Loaded ' + totalLoaded + ' registration centres into LUT (' + lut.size + ' unique keys)');
  return lut;
}

function normalize(text) {
  if (!text) return '';
  return text.toUpperCase().replace(/\s+/g, ' ').trim();
}

function methodA_lookup(office, rcLUT) {
  // Try exact match: office_location + county
  const key1 = normalize(office.office_location) + '||' + normalize(office.county);
  if (rcLUT.has(key1)) {
    const rc = rcLUT.get(key1);
    // Reject if it's the same clustered coordinate
    const dist = haversine(office.latitude, office.longitude, rc.lat, rc.lng);
    if (dist > 30) { // At least 30m different = genuinely different location
      return {
        lat: rc.lat, lng: rc.lng,
        confidence: rc.confidence,
        method: 'google_maps_scraper_v14',
        address: rc.address
      };
    }
  }
  // No match or same coordinate
  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// METHOD B: precision_geocoding — Google Maps Geocoding API (the actual API)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function methodB_precision(office) {
  // Use Google Maps Geocoding API with full address components
  if (!GOOGLE_MAPS_API_KEY) return null;

  const query = buildQuery(office);
  const encodedQuery = encodeURIComponent(query);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedQuery}&key=${GOOGLE_MAPS_API_KEY}&region=ke&bounds=-4.9,33.5|5.5,42.0`;

  try {
    const data = await httpGet(url);
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      if (isInKenya(loc.lat, loc.lng)) {
        const dist = haversine(office.latitude, office.longitude, loc.lat, loc.lng);
        if (dist > 30) {
          return {
            lat: loc.lat, lng: loc.lng,
            confidence: data.results[0].geometry.location_type === 'ROOFTOP' ? 0.95 :
                        data.results[0].geometry.location_type === 'RANGE_INTERPOLATED' ? 0.85 :
                        data.results[0].geometry.location_type === 'GEOMETRIC_CENTER' ? 0.7 : 0.5,
            method: 'precision_google_maps_v15',
            address: data.results[0].formatted_address
          };
        }
      }
    }
  } catch (e) { /* swallow */ }
  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// METHOD C: multi_source_crossvalidated — LocationIQ + OpenCage + Nominatim
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function geocodeLocationIQ(query) {
  if (!LOCATIONIQ_API_KEY) return null;
  const url = `https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_API_KEY}&q=${encodeURIComponent(query)}&countrycodes=ke&format=json&limit=1`;
  try {
    const data = await httpGet(url);
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (isInKenya(lat, lng)) return { lat, lng, address: data[0].display_name, confidence: 0.75, method: 'locationiq_v15' };
    }
  } catch (e) { /* swallow */ }
  return null;
}

async function geocodeOpenCage(query) {
  if (!OPENCAGE_API_KEY) return null;
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_API_KEY}&countrycode=ke&limit=1&no_annotations=1`;
  try {
    const data = await httpGet(url);
    if (data.results && data.results.length > 0) {
      const g = data.results[0].geometry;
      if (isInKenya(g.lat, g.lng)) return { lat: g.lat, lng: g.lng, address: data.results[0].formatted, confidence: data.results[0].confidence / 10, method: 'opencage_v15' };
    }
  } catch (e) { /* swallow */ }
  return null;
}

async function geocodeNominatim(query) {
  const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&countrycodes=ke&format=json&limit=1`;
  try {
    const data = await httpGet(url);
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (isInKenya(lat, lng)) return { lat, lng, address: data[0].display_name, confidence: 0.6, method: 'nominatim_v15' };
    }
  } catch (e) { /* swallow */ }
  return null;
}

async function methodC_multiSource(office) {
  const query = buildQuery(office);

  // Run all 3 concurrently
  const [liq, oc, nom] = await Promise.all([
    geocodeLocationIQ(query),
    geocodeOpenCage(query),
    geocodeNominatim(query)
  ]);

  const results = [liq, oc, nom].filter(Boolean);
  // Filter out results that are same as the original clustered coordinate
  const validResults = results.filter(r => haversine(office.latitude, office.longitude, r.lat, r.lng) > 30);

  if (validResults.length === 0) return null;
  if (validResults.length === 1) return { ...validResults[0], method: 'multi_source_single_v15' };

  // Cross-validate: find closest agreeing pair, average them
  let bestPair = null;
  let bestDist = Infinity;
  for (let i = 0; i < validResults.length; i++) {
    for (let j = i + 1; j < validResults.length; j++) {
      const dist = haversine(validResults[i].lat, validResults[i].lng, validResults[j].lat, validResults[j].lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestPair = [validResults[i], validResults[j]];
      }
    }
  }

  if (bestPair && bestDist < 2000) {
    return {
      lat: (bestPair[0].lat + bestPair[1].lat) / 2,
      lng: (bestPair[0].lng + bestPair[1].lng) / 2,
      address: bestPair[0].address,
      confidence: Math.min(0.9, Math.max(bestPair[0].confidence, bestPair[1].confidence) + 0.1),
      method: 'multi_source_crossvalidated_v15'
    };
  }

  // No agreement — use highest confidence
  validResults.sort((a, b) => b.confidence - a.confidence);
  return validResults[0];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Query Builder & DB Update
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildQuery(office) {
  const parts = [];
  if (office.office_location) parts.push(office.office_location);
  if (office.ward) parts.push(office.ward);
  if (office.constituency_name) parts.push(office.constituency_name);
  if (office.county) parts.push(office.county + ' County');
  parts.push('Kenya');
  return parts.join(', ');
}

async function updateOffice(id, result) {
  const { error } = await supabase
    .from('iebc_offices')
    .update({
      latitude: result.lat,
      longitude: result.lng,
      geocode_method: result.method,
      geocode_confidence: result.confidence,
      geocode_status: 'verified',
      verified: true,
      formatted_address: result.address || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
  if (error) {
    console.error(`  UPDATE FAIL id=${id}: ${error.message}`);
    return false;
  }
  return true;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Pipeline: A → (B + C) concurrent
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  NASAKA GEOC-v15: CONCURRENT RE-GEOCODING PIPELINE');
  console.log('  Architecture: A → (B + C) concurrent fallback');
  console.log('='.repeat(60));
  console.log('');

  console.log('API Keys:');
  console.log('  Google Maps API:', GOOGLE_MAPS_API_KEY ? 'YES' : 'MISSING');
  console.log('  LocationIQ:', LOCATIONIQ_API_KEY ? 'YES' : 'MISSING');
  console.log('  OpenCage:', OPENCAGE_API_KEY ? 'YES' : 'MISSING');
  console.log('  Nominatim:', NOMINATIM_URL ? 'YES' : 'MISSING');
  console.log('');

  // ─── Load RC Lookup Table ──────────────────────────────────────────────────
  console.log('Loading iebc_registration_centres into lookup table...');
  const rcLUT = await loadRegistrationCentresLUT();
  console.log('');

  // ─── Fetch all offices and identify clusters ──────────────────────────────
  console.log('Fetching all offices...');
  let allOffices = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('iebc_offices')
      .select('id, latitude, longitude, county, constituency_name, office_location, office_type, geocode_method, geocode_confidence, ward')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .range(from, from + batchSize - 1);
    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allOffices.push(...data);
    from += data.length;
    if (data.length < batchSize) break;
  }
  console.log('Total offices with coords: ' + allOffices.length);

  // Identify clusters (3+ sharing same coordinate)
  const coordMap = new Map();
  for (const o of allOffices) {
    const key = o.latitude + ',' + o.longitude;
    if (!coordMap.has(key)) coordMap.set(key, []);
    coordMap.get(key).push(o);
  }
  const clustered = [];
  for (const [_, offices] of coordMap.entries()) {
    if (offices.length >= 3) clustered.push(...offices);
  }
  console.log('Clustered centres (3+ sharing): ' + clustered.length);
  console.log('');

  if (clustered.length === 0) {
    console.log('No clustered centres. Pipeline complete.');
    return;
  }

  // ─── Process each clustered centre ─────────────────────────────────────────
  const stats = {
    methodA: 0,   // google_maps_scraper_v14 (RC table sync)
    methodB: 0,   // precision_google_maps_v15
    methodC: 0,   // multi_source_crossvalidated_v15
    unresolved: 0,
    errors: 0,
    total: clustered.length
  };

  console.log('='.repeat(60));
  console.log('  PROCESSING: A → (B + C) concurrent');
  console.log('='.repeat(60));
  console.log('');

  // Process in batches of 10 for concurrency control on API rate limits
  const BATCH_SIZE = 10;
  const RATE_LIMIT_MS = 250; // 4 requests/sec effective rate to respect all APIs

  for (let batchStart = 0; batchStart < clustered.length; batchStart += BATCH_SIZE) {
    const batch = clustered.slice(batchStart, batchStart + BATCH_SIZE);

    const batchPromises = batch.map(async (office) => {
      // ─── METHOD A: google_maps_scraper_v14 (instant LUT lookup) ────────
      const resultA = methodA_lookup(office, rcLUT);
      if (resultA) {
        const updated = await updateOffice(office.id, resultA);
        if (updated) { stats.methodA++; return 'A'; }
        else { stats.errors++; return 'ERR'; }
      }

      // ─── A failed → Run B + C CONCURRENTLY ────────────────────────────
      const [resultB, resultC] = await Promise.all([
        methodB_precision(office),
        methodC_multiSource(office)
      ]);

      // Pick the best result from B and C
      const candidates = [resultB, resultC].filter(Boolean);
      if (candidates.length === 0) {
        stats.unresolved++;
        return 'NONE';
      }

      // If both succeeded, pick higher confidence
      candidates.sort((a, b) => b.confidence - a.confidence);
      const winner = candidates[0];
      const updated = await updateOffice(office.id, winner);
      if (updated) {
        if (winner.method.startsWith('precision_')) stats.methodB++;
        else stats.methodC++;
        return winner.method;
      } else {
        stats.errors++;
        return 'ERR';
      }
    });

    await Promise.all(batchPromises);

    // Progress log every 100
    const processed = Math.min(batchStart + BATCH_SIZE, clustered.length);
    if (processed % 100 === 0 || processed === clustered.length) {
      console.log(`  [${processed}/${clustered.length}] A=${stats.methodA} B=${stats.methodB} C=${stats.methodC} unresolved=${stats.unresolved} err=${stats.errors}`);
    }

    await sleep(RATE_LIMIT_MS);
  }

  // ─── Handle unresolved: deterministic centroid spread ──────────────────────
  if (stats.unresolved > 0) {
    console.log('');
    console.log(`  Applying deterministic centroid spread for ${stats.unresolved} unresolved centres...`);
    
    // Re-fetch to find which are still clustered after B+C
    const postOffices = await fetchAllCurrentClustered();
    let spreadCount = 0;

    const postCoordMap = new Map();
    for (const o of postOffices) {
      const key = o.latitude + ',' + o.longitude;
      if (!postCoordMap.has(key)) postCoordMap.set(key, []);
      postCoordMap.get(key).push(o);
    }

    for (const [coordKey, offices] of postCoordMap.entries()) {
      if (offices.length < 3) continue;
      const [baseLat, baseLng] = coordKey.split(',').map(Number);

      for (let i = 0; i < offices.length; i++) {
        const angle = (2 * Math.PI * i) / Math.min(offices.length, 12) + (Math.floor(i / 12) * 0.5);
        const ring = Math.floor(i / 12) + 1;
        const radiusMeters = 80 * ring;
        const latOffset = (radiusMeters * Math.cos(angle)) / 111320;
        const lngOffset = (radiusMeters * Math.sin(angle)) / (111320 * Math.cos(baseLat * Math.PI / 180));

        const updated = await updateOffice(offices[i].id, {
          lat: baseLat + latOffset,
          lng: baseLng + lngOffset,
          confidence: 0.2,
          method: 'centroid_spread_v15',
          address: null
        });
        if (updated) spreadCount++;
      }
    }
    console.log(`  Spread ${spreadCount} centres around their centroids.`);
  }

  // ─── Final Report ──────────────────────────────────────────────────────────
  console.log('');
  console.log('='.repeat(60));
  console.log('  FINAL REPORT');
  console.log('='.repeat(60));
  console.log('  Total clustered input: ' + stats.total);
  console.log('  Method A (google_maps_scraper_v14): ' + stats.methodA);
  console.log('  Method B (precision_google_maps): ' + stats.methodB);
  console.log('  Method C (multi_source_crossvalidated): ' + stats.methodC);
  console.log('  Unresolved (centroid spread applied): ' + stats.unresolved);
  console.log('  Errors: ' + stats.errors);
  console.log('');
  console.log('Pipeline complete. ✊🏽🇰🇪');
}

async function fetchAllCurrentClustered() {
  let all = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('iebc_offices')
      .select('id, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .range(from, from + batchSize - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    all.push(...data);
    from += data.length;
    if (data.length < batchSize) break;
  }
  return all;
}

main().catch(err => {
  console.error('PIPELINE FATAL ERROR:', err);
  process.exit(1);
});
