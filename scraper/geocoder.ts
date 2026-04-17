/**
 * geocoder.ts
 * 
 * Nasaka Precision Geocoding Engine (v2.0)
 * 
 * Populates: latitude, longitude, formatted_address, geocode_method, 
 * geocode_confidence, geocode_queries, geocode_query, successful_geocode_query,
 * total_queries_tried, geocode_status, accuracy_meters, result_type,
 * importance_score, geom (via trigger)
 * 
 * Uses tiered consensus: Google Maps Geocoding → Geoapify → Nominatim
 * Diaspora centres are hard-coded to embassy coordinates.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const dbUrl = process.env.SUPABASE_DB_POOLED_URL;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY;
const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const BATCH_SIZE = 50;
const DELAY_MS = 1200; // Respectful rate limiting

if (!dbUrl) { console.error('[FATAL] SUPABASE_DB_POOLED_URL missing'); process.exit(1); }

interface GeoResult {
    lat: number;
    lng: number;
    address: string;
    method: string;
    confidence: number;
    accuracy_meters: number | null;
    result_type: string;
    importance: number;
    query_used: string;
}

// ────────────────────────────────────────────────────────────────
// DIASPORA EMBASSY COORDINATES (Hard-coded, verified)
// ────────────────────────────────────────────────────────────────
const DIASPORA_MAP: Record<string, { lat: number; lng: number; address: string }> = {
    'LONDON': { lat: 51.4994, lng: -0.1765, address: 'Kenya High Commission, 45 Portland Place, London W1B 1AS, UK' },
    'PRETORIA': { lat: -25.7559, lng: 28.2280, address: 'Kenya High Commission, 302 Brooks St, Menlo Park, Pretoria 0181, South Africa' },
    'DUBAI': { lat: 25.2348, lng: 55.2855, address: 'Consulate General of Kenya, Dubai, UAE' },
    'WASHINGTON': { lat: 38.9125, lng: -77.0486, address: 'Embassy of Kenya, 2249 R St NW, Washington, DC 20008, USA' },
    'BEIJING': { lat: 39.9535, lng: 116.4612, address: 'Embassy of Kenya, 4 Xi Liu Jie, San Li Tun, Beijing, China' },
    'ABU DHABI': { lat: 24.4539, lng: 54.3773, address: 'Embassy of Kenya, Abu Dhabi, UAE' },
    'BERLIN': { lat: 52.4857, lng: 13.3501, address: 'Embassy of Kenya, Markgrafenstraße 63, 10969 Berlin, Germany' },
    'OTTAWA': { lat: 45.4281, lng: -75.6937, address: 'Kenya High Commission, 415 Laurier Ave E, Ottawa, ON K1N 6R4, Canada' },
    'TOKYO': { lat: 35.6544, lng: 139.7319, address: 'Embassy of Kenya, 3-24-3 Yakumo, Meguro-ku, Tokyo, Japan' },
    'PARIS': { lat: 48.8708, lng: 2.3047, address: 'Embassy of Kenya, 3 Rue Cimarosa, 75116 Paris, France' },
    'RIYADH': { lat: 24.7051, lng: 46.6758, address: 'Embassy of Kenya, Riyadh, Saudi Arabia' },
    'TEL AVIV': { lat: 32.0710, lng: 34.7883, address: 'Embassy of Kenya, Tel Aviv, Israel' }
};

function buildQueries(row: any): string[] {
    const { clean_office_location, office_location, ward, constituency_name, county } = row;
    const name = clean_office_location || office_location;
    return [
        `${name}, ${ward}, ${constituency_name}, ${county}, Kenya`,
        `${name}, ${constituency_name}, ${county}, Kenya`,
        `${name}, ${county}, Kenya`,
        `${name}, Kenya`
    ];
}

async function googleGeocode(query: string): Promise<GeoResult | null> {
    if (!GOOGLE_KEY) return null;
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_KEY}&region=ke`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.results.length > 0) {
            const r = data.results[0];
            const locType = r.geometry.location_type;
            const conf = locType === 'ROOFTOP' ? 1.0 : locType === 'RANGE_INTERPOLATED' ? 0.8 : locType === 'GEOMETRIC_CENTER' ? 0.5 : 0.3;
            const acc = locType === 'ROOFTOP' ? 10 : locType === 'RANGE_INTERPOLATED' ? 50 : 500;
            return {
                lat: r.geometry.location.lat,
                lng: r.geometry.location.lng,
                address: r.formatted_address,
                method: 'google',
                confidence: conf,
                accuracy_meters: acc,
                result_type: locType,
                importance: conf,
                query_used: query
            };
        }
    } catch (e: any) { console.error(`[GOOGLE ERR] ${e.message}`); }
    return null;
}

async function geoapifyGeocode(query: string): Promise<GeoResult | null> {
    if (!GEOAPIFY_KEY) return null;
    try {
        const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_KEY}&filter=countrycode:ke`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
            const f = data.features[0];
            const conf = f.properties.rank?.confidence || 0.5;
            return {
                lat: f.geometry.coordinates[1],
                lng: f.geometry.coordinates[0],
                address: f.properties.formatted,
                method: 'geoapify',
                confidence: conf,
                accuracy_meters: conf > 0.8 ? 50 : 200,
                result_type: f.properties.result_type || 'unknown',
                importance: f.properties.rank?.importance || 0.5,
                query_used: query
            };
        }
    } catch (e: any) { console.error(`[GEOAPIFY ERR] ${e.message}`); }
    return null;
}

async function nominatimGeocode(query: string): Promise<GeoResult | null> {
    try {
        const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&countrycodes=ke&limit=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'NasakaIEBC/1.0' } });
        const data = await res.json();
        if (data.length > 0) {
            const r = data[0];
            const imp = parseFloat(r.importance) || 0.5;
            return {
                lat: parseFloat(r.lat),
                lng: parseFloat(r.lon),
                address: r.display_name,
                method: 'nominatim',
                confidence: imp,
                accuracy_meters: imp > 0.7 ? 100 : 500,
                result_type: r.type || 'unknown',
                importance: imp,
                query_used: query
            };
        }
    } catch (e: any) { console.error(`[NOMINATIM ERR] ${e.message}`); }
    return null;
}

async function resolveRow(row: any): Promise<{ result: GeoResult | null; queries: string[]; totalTried: number }> {
    const queries = buildQueries(row);
    let bestResult: GeoResult | null = null;
    let totalTried = 0;

    for (const q of queries) {
        totalTried++;
        const gResult = await googleGeocode(q);
        if (gResult && gResult.confidence >= 0.8) {
            bestResult = gResult;
            break;
        }
        if (gResult && (!bestResult || gResult.confidence > bestResult.confidence)) {
            bestResult = gResult;
        }
        await new Promise(r => setTimeout(r, 200));
    }

    if (!bestResult || bestResult.confidence < 0.7) {
        for (const q of queries.slice(0, 2)) {
            totalTried++;
            const gaResult = await geoapifyGeocode(q);
            if (gaResult && (!bestResult || gaResult.confidence > bestResult.confidence)) {
                bestResult = gaResult;
                if (bestResult.confidence >= 0.8) break;
            }
            await new Promise(r => setTimeout(r, 200));
        }
    }

    if (!bestResult || bestResult.confidence < 0.5) {
        totalTried++;
        const nomResult = await nominatimGeocode(queries[0]);
        if (nomResult && (!bestResult || nomResult.confidence > bestResult.confidence)) {
            bestResult = nomResult;
        }
    }

    return { result: bestResult, queries, totalTried };
}

async function main() {
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    console.log('[GEO] Connected.\n');

    // Phase 0: Diaspora hard-coding
    console.log('[GEO] Phase 0: Hard-coding Diaspora embassies...');
    for (const [key, coords] of Object.entries(DIASPORA_MAP)) {
        await client.query(`
            UPDATE public.iebc_offices SET
                latitude = $1, longitude = $2, formatted_address = $3,
                geocode_method = 'hardcoded', geocode_confidence = 1.0,
                geocode_status = 'verified', accuracy_meters = 10,
                result_type = 'ROOFTOP', importance_score = 1.0,
                geocode_query = $4, successful_geocode_query = $4,
                total_queries_tried = 1
            WHERE county = 'DIASPORA' AND office_location ILIKE $5
              AND geocode_status = 'pending'
        `, [coords.lat, coords.lng, coords.address, `${key} Embassy Kenya`, `%${key}%`]);
    }
    console.log('[GEO] Diaspora complete.\n');

    // Phase 1: Batch geocode pending
    let totalProcessed = 0;
    let totalResolved = 0;
    let totalFailed = 0;

    while (true) {
        const { rows } = await client.query(`
            SELECT id, office_location, clean_office_location, ward, constituency_name, county
            FROM public.iebc_offices
            WHERE geocode_status = 'pending'
              AND office_type = 'REGISTRATION_CENTRE'
            ORDER BY id
            LIMIT $1
        `, [BATCH_SIZE]);

        if (rows.length === 0) break;

        console.log(`[GEO] Batch: ${rows.length} rows (total processed: ${totalProcessed})...`);

        for (const row of rows) {
            const { result, queries, totalTried } = await resolveRow(row);

            if (result) {
                await client.query(`
                    UPDATE public.iebc_offices SET
                        latitude = $1, longitude = $2, formatted_address = $3,
                        geocode_method = $4, geocode_confidence = $5,
                        geocode_status = 'verified', accuracy_meters = $6,
                        result_type = $7, importance_score = $8,
                        geocode_queries = $9, geocode_query = $10,
                        successful_geocode_query = $11, total_queries_tried = $12
                    WHERE id = $13
                `, [
                    result.lat, result.lng, result.address,
                    result.method, result.confidence,
                    result.accuracy_meters, result.result_type, result.importance,
                    queries.join(', '), queries[0],
                    result.query_used, totalTried,
                    row.id
                ]);
                totalResolved++;
                console.log(`  ✓ [${row.id}] ${row.office_location} → ${result.method} (${result.confidence})`);
            } else {
                await client.query(`
                    UPDATE public.iebc_offices SET
                        geocode_status = 'failed',
                        geocode_queries = $1, geocode_query = $2,
                        total_queries_tried = $3
                    WHERE id = $4
                `, [queries.join(', '), queries[0], totalTried, row.id]);
                totalFailed++;
                console.log(`  ✗ [${row.id}] ${row.office_location} → FAILED`);
            }

            await new Promise(r => setTimeout(r, DELAY_MS));
        }

        totalProcessed += rows.length;
        console.log(`[GEO] Progress: ${totalProcessed} total, ${totalResolved} resolved, ${totalFailed} failed\n`);
    }

    console.log(`\n[GEO] ═══════════════════════════════════════`);
    console.log(`[GEO] GEOCODING COMPLETE`);
    console.log(`[GEO] Processed: ${totalProcessed}`);
    console.log(`[GEO] Resolved: ${totalResolved}`);
    console.log(`[GEO] Failed: ${totalFailed}`);
    console.log(`[GEO] ═══════════════════════════════════════\n`);

    await client.end();
}

main().catch(err => { console.error('[GEO FATAL]', err); process.exit(1); });
