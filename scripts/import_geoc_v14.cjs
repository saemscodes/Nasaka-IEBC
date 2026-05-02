/**
 * NASAKA GEOC-v14 CSV → iebc_offices IMPORT
 * 
 * Reads iebc_google_supplementary.csv (GEOC-v14 output, 24,241 resolved at 99.5%)
 * Deduplicates by ID (takes last successful entry per ID)
 * Updates iebc_offices.latitude, longitude, geocode_method via Supabase
 * 
 * Usage: node scripts/import_geoc_v14.cjs
 * ✊🏽🇰🇪
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// ─── Load .env ───────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) { console.error('[FATAL] .env missing'); process.exit(1); }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (val.startsWith('${')) continue;
    process.env[key] = val;
  }
}
loadEnv();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ─── Parse CSV (handles quoted fields with commas, newlines, and ANSI escapes) ──
function parseCSV(filepath) {
  const raw = fs.readFileSync(filepath, 'utf8');
  const rows = [];
  let i = 0;
  const len = raw.length;

  // Parse header
  const headerEnd = raw.indexOf('\n');
  const header = raw.substring(0, headerEnd).trim().split(',');

  i = headerEnd + 1;
  while (i < len) {
    const row = [];
    let fieldCount = 0;

    while (fieldCount < header.length && i < len) {
      if (raw[i] === '"') {
        // Quoted field — scan until closing quote
        i++; // skip opening quote
        let field = '';
        while (i < len) {
          if (raw[i] === '"') {
            if (i + 1 < len && raw[i + 1] === '"') {
              field += '"';
              i += 2;
            } else {
              i++; // skip closing quote
              break;
            }
          } else {
            field += raw[i];
            i++;
          }
        }
        row.push(field);
        // Skip comma or newline after quoted field
        if (i < len && raw[i] === ',') i++;
        else if (i < len && (raw[i] === '\n' || raw[i] === '\r')) {
          if (raw[i] === '\r' && i + 1 < len && raw[i + 1] === '\n') i += 2;
          else i++;
        }
      } else {
        // Unquoted field
        let end = i;
        while (end < len && raw[end] !== ',' && raw[end] !== '\n' && raw[end] !== '\r') end++;
        row.push(raw.substring(i, end));
        i = end;
        if (i < len && raw[i] === ',') i++;
        else if (i < len && (raw[i] === '\n' || raw[i] === '\r')) {
          if (raw[i] === '\r' && i + 1 < len && raw[i + 1] === '\n') i += 2;
          else i++;
        }
      }
      fieldCount++;
    }

    // Skip empty/incomplete rows
    if (row.length >= 5) {
      const obj = {};
      header.forEach((h, idx) => { obj[h] = row[idx] || ''; });
      rows.push(obj);
    }
  }

  return rows;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(60));
  console.log('  GEOC-v14 CSV → iebc_offices IMPORT');
  console.log('='.repeat(60));

  const csvPath = path.join(__dirname, '..', 'data', 'iebc_google_supplementary.csv');
  if (!fs.existsSync(csvPath)) { console.error('[FATAL] CSV not found:', csvPath); process.exit(1); }

  console.log('Parsing CSV...');
  const allRows = parseCSV(csvPath);
  console.log('Total CSV rows:', allRows.length);

  // Deduplicate: keep LAST successful entry per ID
  const byId = new Map();
  let successCount = 0;
  let failCount = 0;

  for (const row of allRows) {
    const id = row.ID;
    const success = row.SUCCESS === 'true';
    const lat = parseFloat(row.LAT);
    const lng = parseFloat(row.LNG);

    if (!id || id.length < 5) continue;

    if (success && !isNaN(lat) && !isNaN(lng)) {
      byId.set(id, { lat, lng, mapsUrl: row.MAPS_URL || '' });
      successCount++;
    } else {
      failCount++;
      // Don't overwrite a successful entry
    }
  }

  console.log('Successful scrape rows:', successCount);
  console.log('Failed scrape rows:', failCount);
  console.log('Unique IDs with coords:', byId.size);

  // ─── Update iebc_offices in batches ────────────────────────────────────────
  console.log('');
  console.log('Updating iebc_offices...');

  let updated = 0;
  let errors = 0;
  let notFound = 0;
  const entries = Array.from(byId.entries());
  const BATCH_SIZE = 50;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async ([id, coords]) => {
      const { error, count } = await supabase
        .from('iebc_offices')
        .update({
          latitude: coords.lat,
          longitude: coords.lng,
          geocode_method: 'google_maps_scraper_v14',
          geocode_confidence: 0.85,
          geocode_status: 'verified',
          verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        errors++;
        return false;
      }
      updated++;
      return true;
    });

    await Promise.all(promises);

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= entries.length) {
      console.log(`  [${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length}] updated=${updated} errors=${errors}`);
    }
  }

  // ─── Also update iebc_registration_centres ─────────────────────────────────
  console.log('');
  console.log('Updating iebc_registration_centres...');

  let rcUpdated = 0;
  let rcErrors = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async ([id, coords]) => {
      const { error } = await supabase
        .from('iebc_registration_centres')
        .update({
          latitude: coords.lat,
          longitude: coords.lng,
          geocode_confidence: 0.85,
          location_source: 'google_maps_scraper_v14',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) { rcErrors++; } else { rcUpdated++; }
    });

    await Promise.all(promises);

    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= entries.length) {
      console.log(`  [${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length}] rcUpdated=${rcUpdated} rcErrors=${rcErrors}`);
    }
  }

  // ─── Final Report ──────────────────────────────────────────────────────────
  console.log('');
  console.log('='.repeat(60));
  console.log('  IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log('  Unique IDs in CSV:', byId.size);
  console.log('  iebc_offices updated:', updated);
  console.log('  iebc_offices errors:', errors);
  console.log('  iebc_registration_centres updated:', rcUpdated);
  console.log('  iebc_registration_centres errors:', rcErrors);
  console.log('');
  console.log('✊🏽🇰🇪 Pipeline complete.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
