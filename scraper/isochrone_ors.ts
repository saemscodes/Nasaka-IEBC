/**
 * isochrone_ors.ts — Step 6 (Optional Post-Pass)
 *
 * ORS (OpenRouteService) Walking Isochrone Generator
 *
 * Generates 15min / 30min / 45min walking isochrones for all geocoded centres
 * using the ORS free API.
 *
 * Populates:
 *   - isochrone_15min (JSONB)
 *   - isochrone_30min (JSONB)
 *   - isochrone_45min (JSONB)
 *   - walking_effort: derived from isochrone area ratio (NOT from elevation_meters)
 *
 * walking_effort derivation:
 *   area_ratio = isochrone_15min_area / isochrone_45min_area
 *   ratio > 0.6   -> 'low'      (flat, open terrain)
 *   ratio 0.4-0.6 -> 'moderate'
 *   ratio 0.2-0.4 -> 'high'
 *   ratio < 0.2   -> 'extreme' (severe walkability constraint)
 *
 * Rate: ORS free tier allows 40 req/min. We cap at 35 req/min (150ms delay min).
 * Resumable: only processes WHERE isochrone_15min IS NULL.
 *
 * NOTE: ORS API key from: https://openrouteservice.org/dev/#/signup
 *       (free tier, no credit card required)
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const dbUrl = process.env.SUPABASE_DB_POOLED_URL;
const ORS_KEY = process.env.ORS_API_KEY;
const BATCH_SIZE = 100;
const DELAY_MS = 175; // ~34 req/min — safe under 40 req/min limit

if (!dbUrl) { console.error('[FATAL] SUPABASE_DB_POOLED_URL missing'); process.exit(1); }
if (!ORS_KEY) { console.error('[FATAL] ORS_API_KEY missing'); process.exit(1); }

const ORS_URL = 'https://api.openrouteservice.org/v2/isochrones/foot-walking';

interface IsochroneResult {
    iso15: object | null;
    iso30: object | null;
    iso45: object | null;
    walking_effort: 'low' | 'moderate' | 'high' | 'extreme' | null;
}

function computePolygonArea(coordinates: number[][][]): number {
    // Shoelace formula on first ring of GeoJSON polygon (in degrees, approximate)
    const ring = coordinates[0];
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        area += (ring[i][0] * ring[i + 1][1]) - (ring[i + 1][0] * ring[i][1]);
    }
    return Math.abs(area / 2);
}

function deriveWalkingEffort(geo15: any, geo45: any): 'low' | 'moderate' | 'high' | 'extreme' | null {
    try {
        const area15 = computePolygonArea(geo15.geometry.coordinates);
        const area45 = computePolygonArea(geo45.geometry.coordinates);
        if (area45 === 0) return null;
        const ratio = area15 / area45;
        if (ratio > 0.6) return 'low';
        if (ratio >= 0.4) return 'moderate';
        if (ratio >= 0.2) return 'high';
        return 'extreme';
    } catch {
        return null;
    }
}

async function fetchIsochrone(lat: number, lng: number, rangeSeconds: number[]): Promise<any | null> {
    try {
        const res = await fetch(ORS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': ORS_KEY!
            },
            body: JSON.stringify({
                locations: [[lng, lat]], // ORS uses [lng, lat]
                range: rangeSeconds,
                range_type: 'time',
                attributes: ['area', 'reachfactor']
            })
        });

        if (res.status === 429) {
            console.warn('  [ORS 429] Rate limit hit — waiting 65s');
            await new Promise(r => setTimeout(r, 65000));
            return null;
        }

        if (res.status === 200) {
            const data = await res.json() as any;
            return data;
        }

        const errText = await res.text();
        console.error(`  [ORS ERR ${res.status}] ${errText.substring(0, 120)}`);
        return null;
    } catch (e: any) {
        console.error(`  [ORS FETCH ERR] ${e.message}`);
        return null;
    }
}

async function processRow(lat: number, lng: number): Promise<IsochroneResult> {
    // Fetch all 3 ranges in a single ORS call: 900s (15min), 1800s (30min), 2700s (45min)
    const data = await fetchIsochrone(lat, lng, [900, 1800, 2700]);

    if (!data?.features?.length) {
        return { iso15: null, iso30: null, iso45: null, walking_effort: null };
    }

    // ORS returns features ordered by range ascending
    const feat15 = data.features.find((f: any) => f.properties.value === 900) || null;
    const feat30 = data.features.find((f: any) => f.properties.value === 1800) || null;
    const feat45 = data.features.find((f: any) => f.properties.value === 2700) || null;

    const walking_effort = (feat15 && feat45) ? deriveWalkingEffort(feat15, feat45) : null;

    return {
        iso15: feat15 || null,
        iso30: feat30 || null,
        iso45: feat45 || null,
        walking_effort
    };
}

async function main() {
    const pg = new Client({ connectionString: dbUrl });
    await pg.connect();
    console.log('[ORS] Step 6: ORS Walking Isochrone Generator');
    console.log('[ORS] Rate cap: 35 req/min (~175ms delay)');
    console.log('[ORS] Isochrone ranges: 15min / 30min / 45min (single call per centre)\n');

    const { rows: [{ count }] } = await pg.query(`
        SELECT COUNT(*) FROM public.iebc_offices
        WHERE office_type = 'REGISTRATION_CENTRE'
          AND latitude IS NOT NULL
          AND isochrone_15min IS NULL
    `);

    const total = Number(count);
    const estHours = (total * DELAY_MS / 1000 / 60).toFixed(1);
    console.log(`[ORS] Pending: ${total} records (~${estHours} minutes at 35 req/min)\n`);

    let processed = 0, succeeded = 0, failedORS = 0;

    while (true) {
        const { rows } = await pg.query(`
            SELECT id, latitude, longitude
            FROM public.iebc_offices
            WHERE office_type = 'REGISTRATION_CENTRE'
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
              AND isochrone_15min IS NULL
            ORDER BY id
            LIMIT $1
        `, [BATCH_SIZE]);

        if (rows.length === 0) break;

        for (const row of rows) {
            const { iso15, iso30, iso45, walking_effort } = await processRow(row.latitude, row.longitude);
            await new Promise(r => setTimeout(r, DELAY_MS));

            if (!iso15) {
                failedORS++;
                // Mark with sentinel so we don't retry endlessly in this run
                // Leave isochrone_15min = NULL for resumability
                process.stdout.write(`  x [${row.id}] ORS failed\n`);
                continue;
            }

            await pg.query(`
                UPDATE public.iebc_offices SET
                    isochrone_15min = $1,
                    isochrone_30min = $2,
                    isochrone_45min = $3,
                    walking_effort  = $4,
                    updated_at      = NOW()
                WHERE id = $5
            `, [
                JSON.stringify(iso15),
                iso30 ? JSON.stringify(iso30) : null,
                iso45 ? JSON.stringify(iso45) : null,
                walking_effort,
                row.id
            ]);

            succeeded++;
            processed++;
            process.stdout.write(`  + [${row.id}] effort=${walking_effort} | ${processed}/${total}\r`);
        }

        console.log(`\n[ORS] Batch complete — Succeeded: ${succeeded}, Failed: ${failedORS}, Total: ${processed}/${total}`);
    }

    // Final audit
    const { rows: [audit] } = await pg.query(`
        SELECT
            COUNT(*) FILTER (WHERE isochrone_15min IS NOT NULL) as iso15_done,
            COUNT(*) FILTER (WHERE isochrone_15min IS NULL)     as iso15_pending,
            COUNT(*) FILTER (WHERE walking_effort IS NOT NULL)  as effort_done
        FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'
    `);

    console.log('\n[ORS] ========= ISOCHRONE FINAL REPORT =========');
    console.log(`  isochrone_15min populated: ${audit.iso15_done}`);
    console.log(`  isochrone_15min pending:   ${audit.iso15_pending}`);
    console.log(`  walking_effort populated:  ${audit.effort_done}`);
    console.log('[ORS] =============================================\n');

    await pg.end();
}

main().catch(err => { console.error('[ORS FATAL]', err); process.exit(1); });
