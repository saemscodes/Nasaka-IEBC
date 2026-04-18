/**
 * elevation_batch.ts — Step 4
 *
 * Google Elevation API — Batch Processor
 *
 * Fetches elevation for all geocoded centres in batches of 512
 * (Google's maximum locations per request).
 *
 * Populates: elevation_meters
 * NOTE: walking_effort is derived from isochrone_ors.ts, NOT from elevation.
 *       elevation_meters stores the absolute altitude for reference only.
 *
 * Cost: ~48 requests for 24,369 records = $0.24 total.
 * Resumable: only processes records where elevation_meters IS NULL.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const dbUrl = process.env.SUPABASE_DB_POOLED_URL;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const BATCH_SIZE = 512;

if (!dbUrl) { console.error('[FATAL] SUPABASE_DB_POOLED_URL missing'); process.exit(1); }
if (!GOOGLE_KEY) { console.error('[FATAL] GOOGLE_MAPS_API_KEY missing'); process.exit(1); }

interface ElevationResult {
    id: number;
    elevation: number;
}

async function fetchElevations(batch: { id: number; lat: number; lng: number }[]): Promise<ElevationResult[]> {
    const locationStr = batch.map(r => `${r.lat},${r.lng}`).join('|');
    const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${encodeURIComponent(locationStr)}&key=${GOOGLE_KEY}`;

    try {
        const res = await fetch(url);
        const data = await res.json() as any;

        if (data.status !== 'OK') {
            console.error(`  [ELEVATION ERR] Status: ${data.status} | ${data.error_message || ''}`);
            return [];
        }

        return data.results.map((r: any, i: number) => ({
            id: batch[i].id,
            elevation: r.elevation
        }));
    } catch (e: any) {
        console.error(`  [ELEVATION FETCH ERR] ${e.message}`);
        return [];
    }
}

async function main() {
    const pg = new Client({ connectionString: dbUrl });
    await pg.connect();
    console.log('[ELEVATION] Step 4: Google Elevation API Batch Processor');
    console.log('[ELEVATION] Batch size: 512 locations/request\n');

    // Count pending
    const { rows: [{ count }] } = await pg.query(`
        SELECT COUNT(*) FROM public.iebc_offices
        WHERE office_type = 'REGISTRATION_CENTRE'
          AND latitude IS NOT NULL
          AND elevation_meters IS NULL
    `);
    console.log(`[ELEVATION] Pending: ${count} records (~${Math.ceil(Number(count) / BATCH_SIZE)} requests)\n`);

    let totalProcessed = 0, totalFailed = 0;
    const estCost = (Math.ceil(Number(count) / BATCH_SIZE) / 1000 * 5).toFixed(4);
    console.log(`[ELEVATION] Estimated cost: $${estCost}\n`);

    let lastId = 0;

    while (true) {
        const { rows } = await pg.query(`
            SELECT id, latitude, longitude
            FROM public.iebc_offices
            WHERE office_type = 'REGISTRATION_CENTRE'
              AND latitude IS NOT NULL
              AND longitude IS NOT NULL
              AND elevation_meters IS NULL
              AND id > $1
            ORDER BY id
            LIMIT $2
        `, [lastId, BATCH_SIZE]);

        if (rows.length === 0) break;
        lastId = rows[rows.length - 1].id;

        const batch = rows.map(r => ({ id: r.id, lat: r.latitude, lng: r.longitude }));
        const results = await fetchElevations(batch);

        if (results.length === 0) {
            console.error(`  [ELEVATION] Batch failed for ${batch.length} records. Skipping.`);
            // Mark failed batch as processed to avoid infinite loop
            for (const b of batch) {
                await pg.query(`UPDATE public.iebc_offices SET elevation_meters = -9999 WHERE id = $1`, [b.id]);
            }
            totalFailed += batch.length;
            continue;
        }

        // Batch write results
        const ids = results.map(r => r.id);
        const elevations = results.map(r => r.elevation);

        await pg.query(`
            UPDATE public.iebc_offices AS t
            SET elevation_meters = u.elevation,
                updated_at = NOW()
            FROM (
                SELECT unnest($1::int[]) AS id, unnest($2::float[]) AS elevation
            ) AS u
            WHERE t.id = u.id
        `, [ids, elevations]);

        totalProcessed += results.length;
        process.stdout.write(`  [ELEVATION] Processed: ${totalProcessed} / ${count}\r`);

        // Respectful delay between batches
        await new Promise(r => setTimeout(r, 200));
    }

    // Clean up the -9999 sentinels (failed markers → null)
    if (totalFailed > 0) {
        await pg.query(`UPDATE public.iebc_offices SET elevation_meters = NULL WHERE elevation_meters = -9999`);
    }

    // Audit
    const { rows: [audit] } = await pg.query(`
        SELECT
            COUNT(*) FILTER (WHERE elevation_meters IS NOT NULL) as resolved,
            COUNT(*) FILTER (WHERE elevation_meters IS NULL) as missing
        FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'
    `);

    console.log(`\n\n[ELEVATION] Complete.`);
    console.log(`  Resolved: ${audit.resolved}`);
    console.log(`  Missing:  ${audit.missing}`);
    console.log(`  Failed batches: ${totalFailed}`);

    await pg.end();
}

main().catch(err => { console.error('[ELEVATION FATAL]', err); process.exit(1); });
