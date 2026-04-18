/**
 * places_nlp.ts — Step 2 (String B, Tier 1)
 *
 * Google Places Nearby Search — Landmark Enrichment
 *
 * Targets records with NO directional text in office_location or notes
 * (those WITH directional text go to Tier 2: nlp-enrichment-v2.ts).
 *
 * Populates: distance_from_landmark, direction_type, direction_landmark,
 *            landmark_type, landmark_subtype
 *
 * Rules:
 *  - Only processes records where geocode_status = 'verified' AND lat/lng not null
 *  - Radius: 1000m (expanded for rural coverage)
 *  - Budget gate: script tracks API spend and stops before overrun
 *  - Bearing → direction_type: "North" | "Northeast" | "East" | etc.
 *  - Haversine for distance_from_landmark
 *  - Max 8 QPS (125ms delay) — Google Places allows 10 QPS
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const dbUrl = process.env.SUPABASE_DB_POOLED_URL;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const BATCH_SIZE = 100;
const DELAY_MS = 125; // 8 QPS
const PLACES_COST_PER_1K = 32; // USD
let totalCallsMade = 0;

// Cap at 350 USD for Places budget (allows ~10,937 calls)
// Adjust via env: PLACES_BUDGET_USD
const BUDGET_USD = parseFloat(process.env.PLACES_BUDGET_USD || '350');
const MAX_CALLS = Math.floor((BUDGET_USD / PLACES_COST_PER_1K) * 1000);

if (!dbUrl) { console.error('[FATAL] SUPABASE_DB_POOLED_URL missing'); process.exit(1); }
if (!GOOGLE_KEY) { console.error('[FATAL] GOOGLE_MAPS_API_KEY missing'); process.exit(1); }

// Directional text patterns — if ANY of these appear, route to Tier 2 (LLM), not Tier 1 (Places)
const DIRECTIONAL_PATTERNS = [
    /next to/i, /opposite/i, /behind/i, /near/i, /\bnear\b/i,
    /along/i, /\bat\b/i, /adjacent/i, /beside/i, /in front/i,
    /\d+\s*m\b/i, /junction/i, /corner/i
];

function hasDirectionalText(row: any): boolean {
    const text = `${row.office_location || ''} ${row.notes || ''}`;
    return DIRECTIONAL_PATTERNS.some(p => p.test(text));
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingToDirection(lat1: number, lng1: number, lat2: number, lng2: number): string {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1R = lat1 * Math.PI / 180;
    const lat2R = lat2 * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2R);
    const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);
    const brng = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    const dirs = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
    return dirs[Math.round(brng / 45) % 8];
}

function normalizeLandmarkType(types: string[]): { landmark_type: string; landmark_subtype: string | null } {
    const TYPE_MAP: Record<string, string> = {
        school: 'school', primary_school: 'school', secondary_school: 'school',
        university: 'school', church: 'church', place_of_worship: 'church',
        mosque: 'mosque', hospital: 'hospital', clinic: 'hospital',
        health: 'hospital', market: 'market', shopping_mall: 'market',
        store: 'market', government: 'government_building',
        local_government_office: 'government_building', police: 'government_building',
        stadium: 'sports_facility', park: 'park', road: 'road',
        transit_station: 'transport', bus_station: 'transport'
    };
    const primary = types[0] || 'establishment';
    const secondary = types[1] || null;
    return {
        landmark_type: TYPE_MAP[primary] || 'other',
        landmark_subtype: secondary ? (TYPE_MAP[secondary] || secondary) : null
    };
}

async function placesNearby(lat: number, lng: number): Promise<any | null> {
    try {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=1000&type=establishment&key=${GOOGLE_KEY}`;
        const res = await fetch(url);
        const data = await res.json() as any;
        if (data.status === 'OK' && data.results?.length) {
            return data.results[0];
        }
        if (data.status === 'OVER_QUERY_LIMIT') {
            console.warn('  [PLACES] OVER_QUERY_LIMIT — pausing 60s');
            await new Promise(r => setTimeout(r, 60000));
        }
        return null;
    } catch (e: any) {
        console.error(`  [PLACES ERR] ${e.message}`);
        return null;
    }
}

async function main() {
    const pg = new Client({ connectionString: dbUrl });
    await pg.connect();
    console.log('[PLACES-NLP] Step 2: String B Tier 1 — Google Places Nearby Search');
    console.log(`[PLACES-NLP] Budget cap: $${BUDGET_USD} USD (~${MAX_CALLS} calls max)\n`);

    let processed = 0, enriched = 0, skipped_directional = 0, budget_exhausted = false;
    let lastId = 0;

    while (!budget_exhausted) {
        if (totalCallsMade >= MAX_CALLS) {
            console.log(`[PLACES-NLP] Budget cap reached (${totalCallsMade} calls = ~$${(totalCallsMade / 1000 * PLACES_COST_PER_1K).toFixed(2)})`);
            budget_exhausted = true;
            break;
        }

        const { rows } = await pg.query(`
            SELECT id, office_location, notes, latitude, longitude, constituency, ward, county
            FROM public.iebc_offices
            WHERE office_type = 'REGISTRATION_CENTRE'
              AND geocode_status = 'verified'
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
              AND direction_landmark IS NULL
              AND landmark_type IS NULL
              AND id > $1
            ORDER BY id
            LIMIT $2
        `, [lastId, BATCH_SIZE]);

        if (rows.length === 0) break;
        lastId = rows[rows.length - 1].id;

        for (const row of rows) {
            processed++;

            // Route check: if has directional text, skip to Tier 2 (nlp-enrichment-v2)
            if (hasDirectionalText(row)) {
                skipped_directional++;
                continue;
            }

            if (totalCallsMade >= MAX_CALLS) {
                budget_exhausted = true;
                break;
            }

            const place = await placesNearby(row.latitude, row.longitude);
            totalCallsMade++;
            await new Promise(r => setTimeout(r, DELAY_MS));

            if (!place) continue;

            const placeLat = place.geometry.location.lat;
            const placeLng = place.geometry.location.lng;
            const distMeters = Math.round(haversineMeters(row.latitude, row.longitude, placeLat, placeLng));
            const direction = bearingToDirection(row.latitude, row.longitude, placeLat, placeLng);
            const { landmark_type, landmark_subtype } = normalizeLandmarkType(place.types || []);

            await pg.query(`
                UPDATE public.iebc_offices SET
                    direction_landmark    = $1,
                    direction_type        = $2,
                    distance_from_landmark = $3,
                    landmark_type         = $4,
                    landmark_subtype      = $5,
                    landmark              = COALESCE(landmark, $1),
                    landmark_normalized   = $1,
                    landmark_source       = 'google_places_nearby_v1',
                    updated_at = NOW()
                WHERE id = $6
            `, [
                place.name, direction, distMeters,
                landmark_type, landmark_subtype,
                row.id
            ]);
            enriched++;

            process.stdout.write(`  + [${row.id}] ${row.office_location?.substring(0, 35)} -> ${place.name} (${distMeters}m ${direction})\n`);
        }

        const spend = (totalCallsMade / 1000 * PLACES_COST_PER_1K).toFixed(2);
        console.log(`[PLACES-NLP] Progress: ${processed} processed, ${enriched} enriched, ${skipped_directional} sent to Tier2 | Spend: ~$${spend}\n`);
    }

    const { rows: [summary] } = await pg.query(`
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE direction_landmark IS NOT NULL) as enriched,
            COUNT(*) FILTER (WHERE direction_landmark IS NULL) as bare
        FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'
    `);

    console.log('\n[PLACES-NLP] Summary:');
    console.log(`  Total Places API calls: ${totalCallsMade} (~$${(totalCallsMade / 1000 * PLACES_COST_PER_1K).toFixed(2)})`);
    console.log(`  Enriched globally:  ${summary.enriched}/${summary.total}`);
    console.log(`  Still bare (Tier2): ${summary.bare}`);

    await pg.end();
}

main().catch(err => { console.error('[PLACES-NLP FATAL]', err); process.exit(1); });
