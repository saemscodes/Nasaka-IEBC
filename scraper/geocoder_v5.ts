/**
 * geocoder_v5.ts — Step 1
 *
 * Nasaka Precision Geocoding Engine v5.0
 * Nasaka Powerhouse Edition — 2026-04-18
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const dbUrl = process.env.SUPABASE_DB_POOLED_URL;

// NASAKA POWERHOUSE SUITE KEYS
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY;
const ARCGIS_KEY_PRIMARY = process.env.ARCGIS_API_KEY_PRIMARY;
const ARCGIS_KEY_SECONDARY = process.env.ARCGIS_API_KEY_SECONDARY;
const OPENCAGE_KEY = process.env.OPENCAGE_API_KEY;
const LOCATIONIQ_KEY = process.env.LOCATIONIQ_API_KEY;
const GEOCODE_EARTH_KEY = process.env.GEOCODE_EARTH_API_KEY;
const POSITIONSTACK_KEY = process.env.POSITIONSTACK_API_KEY;
const GEOCODE_MAPS_KEY = process.env.GEOCODE_MAPS_API_KEY;
const BIGDATACLOUD_KEY = process.env.BIGDATACLOUD_API_KEY;
const GEONAMES_USER = process.env.GEONAMES_USERNAME;
const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';

const BATCH_SIZE = 200;
const MAX_CONCURRENT = 10;
const BASE_DELAY_MS = 100;
const INTER_BATCH_DELAY_MS = 2000;

const KE_LAT_MIN = -4.72, KE_LAT_MAX = 4.62;
const KE_LNG_MIN = 33.91, KE_LNG_MAX = 41.91;

if (!dbUrl) { console.error('[FATAL] SUPABASE_DB_POOLED_URL missing'); process.exit(1); }

interface GeoResult {
    lat: number;
    lng: number;
    address: string;
    method: string;
    confidence: number;
    accuracy_meters: number;
    result_type: string;
    location_type: string;
    importance: number;
    query_used: string;
    status: 'verified' | 'approximate' | 'hitl_review' | 'failed';
    should_write_coords: boolean;
}

// Diaspora Hard-Coding
const DIASPORA_MAP: Record<string, { lat: number; lng: number; address: string }> = {
    'LONDON': { lat: 51.4994, lng: -0.1765, address: 'Kenya High Commission, 45 Portland Place, London W1B 1AS, UK' },
    'PRETORIA': { lat: -25.7559, lng: 28.2280, address: 'Kenya High Commission, 302 Brooks St, Menlo Park, Pretoria 0181, South Africa' },
    'DUBAI': { lat: 25.2348, lng: 55.2855, address: 'Consulate General of Kenya, Dubai, UAE' },
    'WASHINGTON': { lat: 38.9125, lng: -77.0486, address: 'Embassy of Kenya, 2249 R St NW, Washington, DC 20008, USA' },
    'BEIJING': { lat: 39.9535, lng: 116.4612, address: 'Embassy of Kenya, 4 Xi Liu Jie, San Li Tun, Beijing, China' },
    'ABU DHABI': { lat: 24.4539, lng: 54.3773, address: 'Embassy of Kenya, Abu Dhabi, UAE' },
    'BERLIN': { lat: 52.4857, lng: 13.3501, address: 'Embassy of Kenya, Markgrafenstrasse 63, 10969 Berlin, Germany' },
    'OTTAWA': { lat: 45.4281, lng: -75.6937, address: 'Kenya High Commission, 415 Laurier Ave E, Ottawa, ON K1N 6R4, Canada' },
    'TOKYO': { lat: 35.6544, lng: 139.7319, address: 'Embassy of Kenya, 3-24-3 Yakumo, Meguro-ku, Tokyo, Japan' },
    'PARIS': { lat: 48.8708, lng: 2.3047, address: 'Embassy of Kenya, 3 Rue Cimarosa, 75116 Paris, France' },
    'RIYADH': { lat: 24.7051, lng: 46.6758, address: 'Embassy of Kenya, Riyadh, Saudi Arabia' },
    'TEL AVIV': { lat: 32.0710, lng: 34.7883, address: 'Embassy of Kenya, Tel Aviv, Israel' }
};

function bboxValid(lat: number, lng: number): boolean {
    return lat >= KE_LAT_MIN && lat <= KE_LAT_MAX && lng >= KE_LNG_MIN && lng <= KE_LNG_MAX;
}

function buildStringA(row: any): string[] {
    const loc = (row.clean_office_location || row.office_location || '').trim();
    const ward = (row.ward || '').trim();
    const con = (row.constituency || '').trim();
    const county = (row.county || '').trim();
    const primary = ward ? `${loc}, ${ward}, ${con}, ${county} County, Kenya` : `${loc}, ${con}, ${county} County, Kenya`;
    const bare = `${con} IEBC Registration Centre, ${county}, Kenya`;
    return [primary, bare];
}

async function googleGeocode(query: string, attempt = 0): Promise<GeoResult | null> {
    if (!GOOGLE_KEY) return null;
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_KEY}&region=ke`;
        const res = await fetch(url);
        if (res.status === 429 && attempt < 3) {
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
            return googleGeocode(query, attempt + 1);
        }
        const data = await res.json() as any;
        if (data.status !== 'OK' || !data.results?.length) return null;
        const r = data.results[0];
        const lat = r.geometry.location.lat, lng = r.geometry.location.lng;
        if (!bboxValid(lat, lng)) return null;
        const locType = r.geometry.location_type;
        return {
            lat, lng, address: r.formatted_address, method: 'google_geocoding_v5',
            confidence: locType === 'ROOFTOP' ? 1.0 : 0.85, accuracy_meters: locType === 'ROOFTOP' ? 10 : 50,
            result_type: r.types?.[0] || locType, location_type: locType, importance: 1.0,
            query_used: query, status: 'verified', should_write_coords: true
        };
    } catch { return null; }
}

async function arcgisGeocode(query: string, useSecondary = false): Promise<GeoResult | null> {
    const key = useSecondary ? ARCGIS_KEY_SECONDARY : ARCGIS_KEY_PRIMARY;
    if (!key) return null;
    try {
        const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?address=${encodeURIComponent(query)}&f=json&token=${key}&maxLocations=1&countryCode=KE`;
        const res = await fetch(url);
        const data = await res.json() as any;
        if (!data.candidates?.length) return null;
        const c = data.candidates[0];
        const lat = c.location.y, lng = c.location.x;
        if (!bboxValid(lat, lng)) return null;
        return {
            lat, lng, address: c.address, method: 'arcgis',
            confidence: c.score / 100, accuracy_meters: 50,
            result_type: 'point', location_type: 'ARCGIS', importance: c.score / 100,
            query_used: query, status: 'verified', should_write_coords: true
        };
    } catch { return null; }
}

async function opencageGeocode(query: string): Promise<GeoResult | null> {
    if (!OPENCAGE_KEY) return null;
    try {
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_KEY}&countrycode=ke&limit=1`;
        const res = await fetch(url);
        const data = await res.json() as any;
        if (!data.results?.length) return null;
        const r = data.results[0];
        const lat = r.geometry.lat, lng = r.geometry.lng;
        if (!bboxValid(lat, lng)) return null;
        return {
            lat, lng, address: r.formatted, method: 'opencage',
            confidence: r.confidence / 10, accuracy_meters: 100,
            result_type: r.components?._type || 'unknown', location_type: 'OPENCAGE', importance: r.confidence / 10,
            query_used: query, status: 'verified', should_write_coords: true
        };
    } catch { return null; }
}

async function locationiqGeocode(query: string): Promise<GeoResult | null> {
    if (!LOCATIONIQ_KEY) return null;
    try {
        const url = `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=ke`;
        const res = await fetch(url);
        const data = await res.json() as any;
        if (!Array.isArray(data) || !data.length) return null;
        const r = data[0];
        const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
        if (!bboxValid(lat, lng)) return null;
        return {
            lat, lng, address: r.display_name, method: 'locationiq',
            confidence: parseFloat(r.importance) || 0.6, accuracy_meters: 100,
            result_type: r.type || 'unknown', location_type: 'LOCATIONIQ', importance: parseFloat(r.importance) || 0.6,
            query_used: query, status: 'verified', should_write_coords: true
        };
    } catch { return null; }
}

async function geoapifyGeocode(query: string): Promise<GeoResult | null> {
    if (!GEOAPIFY_KEY) return null;
    try {
        const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_KEY}&filter=countrycode:ke`;
        const res = await fetch(url);
        const data = await res.json() as any;
        if (!data.features?.length) return null;
        const f = data.features[0];
        const lat = f.geometry.coordinates[1], lng = f.geometry.coordinates[0];
        if (!bboxValid(lat, lng)) return null;
        return {
            lat, lng, address: f.properties.formatted, method: 'geoapify',
            confidence: f.properties.rank?.confidence || 0.5, accuracy_meters: 100,
            result_type: f.properties.result_type || 'unknown', location_type: 'GEOAPIFY', importance: 0.5,
            query_used: query, status: 'verified', should_write_coords: true
        };
    } catch { return null; }
}

async function positionstackGeocode(query: string): Promise<GeoResult | null> {
    if (!POSITIONSTACK_KEY) return null;
    try {
        const url = `http://api.positionstack.com/v1/forward?access_key=${POSITIONSTACK_KEY}&query=${encodeURIComponent(query)}&country=KE&limit=1`;
        const res = await fetch(url);
        const data = await res.json() as any;
        if (!data.data?.length) return null;
        const r = data.data[0];
        if (!bboxValid(r.latitude, r.longitude)) return null;
        return {
            lat: r.latitude, lng: r.longitude, address: r.label, method: 'positionstack',
            confidence: r.confidence || 0.5, accuracy_meters: 100,
            result_type: r.type || 'unknown', location_type: 'POSITIONSTACK', importance: 0.5,
            query_used: query, status: 'verified', should_write_coords: true
        };
    } catch { return null; }
}

async function nominatimGeocode(query: string): Promise<GeoResult | null> {
    await new Promise(r => setTimeout(r, 1500));
    try {
        const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&countrycodes=ke&limit=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'NasakaIEBC/2.0' } });
        const data = await res.json() as any;
        if (!Array.isArray(data) || !data.length) return null;
        const r = data[0];
        const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
        if (!bboxValid(lat, lng)) return null;
        return {
            lat, lng, address: r.display_name, method: 'nominatim',
            confidence: parseFloat(r.importance) || 0.4, accuracy_meters: 100,
            result_type: r.type || 'unknown', location_type: 'NOMINATIM', importance: 0.4,
            query_used: query, status: 'verified', should_write_coords: true
        };
    } catch { return null; }
}

async function resolveRow(row: any): Promise<{ result: GeoResult | null; queries: string[]; totalTried: number }> {
    const queries = buildStringA(row);
    let totalTried = 0;
    
    // GOOGLE PRIMARY
    for (const q of queries) {
        totalTried++;
        const res = await googleGeocode(q);
        if (res) return { result: res, queries, totalTried };
        await new Promise(r => setTimeout(r, BASE_DELAY_MS));
    }

    // POWERHOUSE FALLBACK CHAIN (Sequential, Highly Efficient)
    const fallbacks = [
        () => arcgisGeocode(queries[0]),
        () => arcgisGeocode(queries[0], true),
        () => opencageGeocode(queries[0]),
        () => locationiqGeocode(queries[0]),
        () => geoapifyGeocode(queries[0]),
        () => positionstackGeocode(queries[0]),
        () => nominatimGeocode(queries[0])
    ];

    for (const fb of fallbacks) {
        totalTried++;
        const res = await fb();
        if (res) return { result: res, queries, totalTried };
        await new Promise(r => setTimeout(r, BASE_DELAY_MS));
    }

    return { result: null, queries, totalTried };
}

async function writeResult(pg: Client, row: any, result: GeoResult, queries: string[], totalTried: number): Promise<void> {
    await pg.query(`
        UPDATE public.iebc_offices SET
            latitude = $1, longitude = $2, formatted_address = $3,
            geocode_method = $4, geocode_confidence = $5, geocode_status = $6,
            accuracy_meters = $7, result_type = $8, importance_score = $9,
            geocode_queries = $10, geocode_query = $11, successful_geocode_query = $12,
            total_queries_tried = $13, source = 'NASAKA Powerhouse Geocoder v5',
            verified = true, updated_at = NOW()
        WHERE id = $14
    `, [
        result.lat, result.lng, result.address, result.method, result.confidence,
        result.status, result.accuracy_meters, result.result_type, result.importance,
        queries.join(' | '), queries[0], result.query_used, totalTried, row.id
    ]);
}

async function processBatch(pg: Client, rows: any[]): Promise<{ resolved: number; failed: number }> {
    let resolved = 0, failed = 0;
    const chunks: any[][] = [];
    for (let i = 0; i < rows.length; i += MAX_CONCURRENT) chunks.push(rows.slice(i, i + MAX_CONCURRENT));

    for (const chunk of chunks) {
        await Promise.all(chunk.map(async (row) => {
            const { result, queries, totalTried } = await resolveRow(row);
            if (result) {
                await writeResult(pg, row, result, queries, totalTried);
                resolved++;
                process.stdout.write(`  + [${row.id}] ${row.office_location?.substring(0, 40)} -> ${result.method} (${result.confidence.toFixed(2)})\n`);
            } else {
                await pg.query(`UPDATE public.iebc_offices SET geocode_status = 'failed', updated_at = NOW() WHERE id = $1`, [row.id]);
                failed++;
                process.stdout.write(`  x [${row.id}] ${row.office_location?.substring(0, 40)} -> FAILED\n`);
            }
        }));
        await new Promise(r => setTimeout(r, BASE_DELAY_MS));
    }
    return { resolved, failed };
}

async function main() {
    const pg = new Client({ connectionString: dbUrl });
    await pg.connect();
    console.log('[POW-v5] Nasaka Powerhouse Geocoder Active. Target: 24,668 records.\n');

    // Diaspora
    for (const [key, coords] of Object.entries(DIASPORA_MAP)) {
        await pg.query(`
            UPDATE public.iebc_offices SET
                latitude = $1, longitude = $2, formatted_address = $3,
                geocode_method = 'hardcoded', geocode_confidence = 1.0,
                geocode_status = 'verified', accuracy_meters = 10,
                verified = true, source = 'NASAKA Powerhouse Diaspora', updated_at = NOW()
            WHERE county = 'DIASPORA' AND office_location ILIKE $4 AND geocode_status = 'pending'
        `, [coords.lat, coords.lng, coords.address, `%${key}%`]);
    }

    let totalProcessed = 0, totalResolved = 0, totalFailed = 0;
    while (true) {
        const { rows } = await pg.query(`
            SELECT id, office_location, ward, constituency, county, latitude, longitude
            FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' AND geocode_status IN ('pending', 'failed') AND county != 'DIASPORA'
            ORDER BY id LIMIT $1
        `, [BATCH_SIZE]);
        if (rows.length === 0) break;
        const { resolved, failed } = await processBatch(pg, rows);
        totalProcessed += rows.length; totalResolved += resolved; totalFailed += failed;
        console.log(`[POW-v5] Batch: ${resolved} OK, ${failed} FAIL | Total: ${totalProcessed}\n`);
        await new Promise(r => setTimeout(r, INTER_BATCH_DELAY_MS));
    }

    const { rows: [summary] } = await pg.query(`
        SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE geocode_status = 'verified') as verified,
               COUNT(*) FILTER (WHERE geocode_status = 'failed') as failed
        FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'
    `);
    console.log('\n========= POWERHOUSE FINAL REPORT =========');
    console.log(`  Total:     ${summary.total}`);
    console.log(`  Verified:  ${summary.verified}`);
    console.log(`  Failed:    ${summary.failed}`);
    console.log('===========================================\n');
    await pg.end();
}

main().catch(err => { console.error('[POW-v5 FATAL]', err); process.exit(1); });
