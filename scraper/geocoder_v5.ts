/**
 * geocoder_v5.ts — Step 1
 *
 * Nasaka Precision Geocoding Engine v5.0
 *
 * Architecture (Implementation Plan v3):
 *  - String A: "{office_location}, {ward}, {constituency}, {county} County, Kenya"
 *    (landmark STRIPPED from query — belongs only in String B)
 *  - ROOFTOP/RANGE_INTERPOLATED → write always (overwrite existing if Google source)
 *  - GEOMETRIC_CENTER/APPROXIMATE → geocode_status = 'hitl_review', coords NOT written
 *  - Kenya bounding box check mandatory before any write
 *  - Max 10 concurrent requests, 100ms delay, exponential backoff on 429
 *  - Resumable via: WHERE geocode_status = 'pending' OR geocode_status = 'failed'
 *  - Preserves existing Diaspora hard-coding from geocoder.ts
 *  - Dedup propagation runs after each batch via dedup_prepass.py
 *
 * Overwrites existing lat/lng only if:
 *   new result = Google (ROOFTOP or RANGE) AND prior method != google/google_geocoding_v5
 *   OR prior geocode_status = 'pending' or 'failed'
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as turf from '@turf/turf';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const dbUrl = process.env.SUPABASE_DB_POOLED_URL;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY;
const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const GEMINI_KEY = process.env.GEMINI_API_KEY;

const BATCH_SIZE = 200;
const MAX_CONCURRENT = 10;
const BASE_DELAY_MS = 100;
const INTER_BATCH_DELAY_MS = 2000;

// Kenya bounding box
const KE_LAT_MIN = -4.72, KE_LAT_MAX = 4.62;
const KE_LNG_MIN = 33.91, KE_LNG_MAX = 41.91;

if (!dbUrl) { console.error('[FATAL] SUPABASE_DB_POOLED_URL missing'); process.exit(1); }

// --- WARDS DYNAMIC SPATIAL ENGINE ---
const wardBoundaries = new Map<string, any>();
function loadWardBoundaries() {
    try {
        const geojsonPath = path.resolve(__dirname, '../public/context/Wards/kenya_wards.geojson');
        if (fs.existsSync(geojsonPath)) {
            const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
            for (const f of data.features || []) {
                const w = (f.properties?.ward || '').toUpperCase().trim();
                const geomType = f.geometry?.type;
                if (w && (geomType === 'Polygon' || geomType === 'MultiPolygon')) {
                    wardBoundaries.set(w, f);
                }
            }
            console.log(`[GEO-v5] Loaded ${wardBoundaries.size} dynamic ward boundary polygons.`);
        } else {
            console.warn('[GEO-v5] kenya_wards.geojson not found! Dynamic shifting area buffer unavailable.');
        }
    } catch(e) {
        console.error('[GEO-v5] Spatial bounds load failed:', e);
    }
}
loadWardBoundaries();

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

// Preserved Diaspora hard-coding from geocoder.ts
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

async function validateSpatial(lat: number, lng: number, row: any, pg: Client): Promise<boolean> {
    if (!bboxValid(lat, lng)) {
        console.warn(`  [REJECT BBOX] lat:${lat} lng:${lng} out of Kenya bounds`);
        return false;
    }

    const wardName = (row.ward || '').trim().toUpperCase();
    if (!wardName) return true; // No ward to check

    const feat = wardBoundaries.get(wardName);
    if (feat) {
        const pt = turf.point([lng, lat]);
        
        // 1. Direct hit? Point in Polygon
        try {
            if (turf.booleanPointInPolygon(pt, feat)) {
                return true;
            }
        } catch(e) {}

        // 2. Dynamic Shift based on exact Ward Area properties
        const areaSqM = turf.area(feat);
        const areaSqKm = areaSqM / 1e6;
        
        // Use Bounding Box span derived radius + 5km buffer to dynamically encompass ANY shape (like Turbi)
        const bbox = turf.bbox(feat);
        const bboxDistKm = turf.distance(turf.point([bbox[0], bbox[1]]), turf.point([bbox[2], bbox[3]]));
        
        const dynamicGateRadius = Math.max(1, (bboxDistKm / 2) + 5); 

        let cent;
        try { cent = turf.centroid(feat); } catch { return false; }
        
        const distToCenter = turf.distance(pt, cent);
        if (distToCenter > dynamicGateRadius) {
            console.warn(`  [REJECT SPATIAL] Outlier: ${distToCenter.toFixed(1)}km from ${wardName} center. Dynamic Area shift gate strictly allows up to ${dynamicGateRadius.toFixed(1)}km`);
            return false;
        }
        return true;
    } else {
        // Fallback: Coordinate DB distance calculation (25km max limit for ward)
        const wardRes = await pg.query(`SELECT latitude, longitude FROM public.wards WHERE upper(ward_name) = $1 LIMIT 1`, [wardName]);
        if (wardRes.rows[0]?.latitude) {
            const wLat = wardRes.rows[0].latitude;
            const wLng = wardRes.rows[0].longitude;
            const dist = turf.distance(turf.point([lng, lat]), turf.point([wLng, wLat]));
            if (dist > 25) {
                console.warn(`  [REJECT SPATIAL FALLBACK] Outlier: ${dist.toFixed(1)}km from ${wardName} centroid. Basic fallback strictly allows up to 25km`);
                return false;
            }
        }
    }
    return true;
}

function buildStringA(row: any): string[] {
    const loc = (row.clean_office_location || row.office_location || '').trim();
    const ward = (row.ward || '').trim();
    const con = (row.constituency || '').trim();
    const county = (row.county || '').trim();

    // Primary: full context, NO landmark (stripped per v3 spec)
    const primary = ward
        ? `${loc}, ${ward}, ${con}, ${county} County, Kenya`
        : `${loc}, ${con}, ${county} County, Kenya`;

    // Bare retry: stripped back to constituency level only
    const bare = `${con} IEBC Registration Centre, ${county}, Kenya`;

    return [primary, bare];
}

async function googleGeocode(query: string, attempt = 0): Promise<GeoResult | null> {
    if (!GOOGLE_KEY) return null;
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_KEY}&region=ke`;
        const res = await fetch(url);

        if (res.status === 429) {
            if (attempt >= 3) return null;
            const backoff = Math.pow(2, attempt) * 1000;
            console.warn(`  [GOOGLE 429] Backing off ${backoff}ms (attempt ${attempt + 1})`);
            await new Promise(r => setTimeout(r, backoff));
            return googleGeocode(query, attempt + 1);
        }

        const data = await res.json() as any;
        if (data.status !== 'OK' || !data.results?.length) return null;

        const r = data.results[0];
        const locType: string = r.geometry.location_type;
        const lat: number = r.geometry.location.lat;
        const lng: number = r.geometry.location.lng;

        // Bounding box check — mandatory
        if (!bboxValid(lat, lng)) {
            console.warn(`  [GEO BBOX FAIL] ${query} -> lat:${lat} lng:${lng} out of Kenya bounds`);
            return null;
        }

        // GEOMETRIC_CENTER and APPROXIMATE → flag for HITL, do NOT write coords
        const isHighQuality = locType === 'ROOFTOP' || locType === 'RANGE_INTERPOLATED';
        const conf = locType === 'ROOFTOP' ? 1.0 : locType === 'RANGE_INTERPOLATED' ? 0.85 : 0;
        const acc = locType === 'ROOFTOP' ? 10 : locType === 'RANGE_INTERPOLATED' ? 50 : 500;

        return {
            lat, lng,
            address: r.formatted_address,
            method: 'google_geocoding_v5',
            confidence: conf,
            accuracy_meters: acc,
            result_type: r.types?.[0] || locType,
            location_type: locType,
            importance: conf,
            query_used: query,
            status: isHighQuality ? 'verified' : 'hitl_review',
            should_write_coords: isHighQuality
        };
    } catch (e: any) {
        console.error(`  [GOOGLE ERR] ${e.message}`);
        return null;
    }
}

async function geoapifyGeocode(query: string): Promise<GeoResult | null> {
    if (!GEOAPIFY_KEY) return null;
    try {
        const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_KEY}&filter=countrycode:ke`;
        const res = await fetch(url);
        const data = await res.json() as any;
        if (!data.features?.length) return null;

        const f = data.features[0];
        const lat: number = f.geometry.coordinates[1];
        const lng: number = f.geometry.coordinates[0];

        if (!bboxValid(lat, lng)) return null;

        const conf: number = f.properties.rank?.confidence || 0.5;

        // Non-Google: only write if lat is currently null
        return {
            lat, lng,
            address: f.properties.formatted,
            method: 'geoapify',
            confidence: conf,
            accuracy_meters: conf > 0.8 ? 50 : 200,
            result_type: f.properties.result_type || 'unknown',
            location_type: 'GEOAPIFY',
            importance: f.properties.rank?.importance || 0.5,
            query_used: query,
            status: conf >= 0.8 ? 'verified' : 'approximate',
            should_write_coords: true // conditional on target being NULL (enforced in resolveRow)
        };
    } catch (e: any) {
        console.error(`  [GEOAPIFY ERR] ${e.message}`);
        return null;
    }
}

async function nominatimGeocode(query: string): Promise<GeoResult | null> {
    try {
        const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&countrycodes=ke&limit=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'NasakaIEBC/2.0' } });
        const data = await res.json() as any;
        if (!data.length) return null;

        const r = data[0];
        const lat = parseFloat(r.lat);
        const lng = parseFloat(r.lon);

        if (!bboxValid(lat, lng)) return null;

        const imp = parseFloat(r.importance) || 0.4;

        return {
            lat, lng,
            address: r.display_name,
            method: 'nominatim',
            confidence: imp,
            accuracy_meters: imp > 0.7 ? 100 : 500,
            result_type: r.type || 'unknown',
            location_type: 'NOMINATIM',
            importance: imp,
            query_used: query,
            status: 'approximate',
            should_write_coords: true // conditional on target being NULL
        };
    } catch (e: any) {
        console.error(`  [NOMINATIM ERR] ${e.message}`);
        return null;
    }
}

async function researchLocation(row: any, pg: Client): Promise<{ canonical_name: string, new_queries: string[] } | null> {
    if (!GEMINI_KEY) return null;
    try {
        const alt = await pg.query(`SELECT office_name FROM public.iebc_offices_legacy_backup WHERE upper(county)=$1 AND upper(constituency)=$2 AND upper(ward)=$3 LIMIT 1`, [
            (row.county||'').toUpperCase(), (row.constituency||'').toUpperCase(), (row.ward||'').toUpperCase()
        ]);
        const altName = alt.rows[0]?.office_name || '';

        const prompt = `Research IEBC Registration Centre: "${row.office_location}". Context: Ward=${row.ward}, Constituency=${row.constituency}, County=${row.county}. Legacy Name: "${altName}".
        Return JSON STRICT format ONLY: {"canonical_name": "clean string", "surgical_queries": ["query1"]}`;
        
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const d = await res.json() as any;
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;
        
        const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
        const json = JSON.parse(jsonStr);
        return { canonical_name: json.canonical_name, new_queries: json.surgical_queries };
    } catch { return null; }
}

async function clusterAudit(pg: Client, processedIds: number[]) {
    if (processedIds.length === 0) return;
    
    const { rows } = await pg.query(`
        SELECT id, office_location, ward, latitude, longitude 
        FROM public.iebc_offices 
        WHERE id = ANY($1) AND latitude IS NOT NULL AND county != 'DIASPORA' AND geocode_method LIKE '%google%'
    `, [processedIds]);

    const coords = new Map<string, number[]>();
    for (const row of rows) {
        const key = `${parseFloat(row.latitude).toFixed(5)},${parseFloat(row.longitude).toFixed(5)}`;
        if (!coords.has(key)) coords.set(key, []);
        coords.get(key)!.push(row.id);
    }

    for (const [key, ids] of Array.from(coords.entries())) {
        if (ids.length > 1) {
            console.log(`  [CLUSTER TITAN] Resolution required for ${ids.length} stacked points at ${key} ...`);
            for (const id of ids) {
                const row = rows.find(r => r.id === id);
                if (!row || !GEMINI_KEY) continue;
                try {
                    const prompt = `Location Cluster Conflict: Multiple offices got geocoded to ${key}. Target: "${row.office_location}" in ${row.ward}. Find a UNIQUE surgical coordinate offset. Return JSON ONLY: {"lat": float, "lng": float}`;
                    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
                        method: 'POST', body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                    });
                    const d = await res.json() as any;
                    const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
                    const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
                    if (json.lat && Math.abs(json.lat - parseFloat(key.split(',')[0])) > 0.00001) {
                        await pg.query(`
                            UPDATE public.iebc_offices SET
                                latitude = $1, longitude = $2,
                                geocode_method = 'ai_cluster_resolved_v8'
                            WHERE id = $3
                        `, [json.lat, json.lng, id]);
                        console.log(`  [RESOLVED TITAN] Unique spatial offset applied for ID ${id}`);
                    }
                } catch {}
            }
        }
    }
}

async function resolveRow(row: any, pg: Client): Promise<{ result: GeoResult | null; queries: string[]; totalTried: number }> {
    const queries = buildStringA(row);
    let totalTried = 0;
    let bestResult: GeoResult | null = null;

    const hasExistingGoogleCoords = row.geocode_method === 'google_geocoding_v5' && row.geocode_status === 'verified';

    // String A — Primary query
    for (const q of queries) {
        totalTried++;
        const gResult = await googleGeocode(q);
        await new Promise(r => setTimeout(r, BASE_DELAY_MS));

        if (gResult && await validateSpatial(gResult.lat, gResult.lng, row, pg)) {
            if (gResult.should_write_coords) {
                // Overwrite policy: Google ROOFTOP/RANGE always overwrites
                bestResult = gResult;
                break;
            }
            if (gResult.status === 'hitl_review') {
                // Flag for HITL but keep searching fallback
                bestResult = gResult;
                break;
            }
        }
    }

    // Non-Google fallback — ONLY if no google result AND existing coords are null
    if ((!bestResult || !bestResult.should_write_coords) && !hasExistingGoogleCoords) {
        for (const q of queries.slice(0, 1)) {
            totalTried++;
            const gaResult = await geoapifyGeocode(q);
            await new Promise(r => setTimeout(r, BASE_DELAY_MS));
            if (gaResult && await validateSpatial(gaResult.lat, gaResult.lng, row, pg)) {
                if (!bestResult || gaResult.confidence > bestResult.confidence) {
                    bestResult = gaResult;
                    if (bestResult.confidence >= 0.8) break;
                }
            }
        }

        if (!bestResult || bestResult.confidence < 0.5) {
            totalTried++;
            const nomResult = await nominatimGeocode(queries[0]);
            await new Promise(r => setTimeout(r, BASE_DELAY_MS));
            if (nomResult && await validateSpatial(nomResult.lat, nomResult.lng, row, pg)) {
                if (!bestResult || nomResult.confidence > bestResult.confidence) {
                    bestResult = nomResult;
                }
            }
        }
    }

    // AI Recursive Research (Titan v8.0)
    if (!bestResult || !bestResult.should_write_coords) {
        console.log(`  [TITAN] No robust consensus. Researching active legacy records for ID ${row.id}...`);
        const research = await researchLocation(row, pg);
        if (research && research.new_queries?.length) {
            for (const q of research.new_queries) {
                totalTried++;
                const gResult = await googleGeocode(q);
                await new Promise(r => setTimeout(r, BASE_DELAY_MS));
                if (gResult && await validateSpatial(gResult.lat, gResult.lng, row, pg)) {
                    if (gResult.should_write_coords) {
                        bestResult = gResult;
                        console.log(`  [TITAN] Surgical AI lookup successful: ${gResult.address}`);
                        break;
                    }
                }
            }
        }
    }

    return { result: bestResult, queries, totalTried };
}

async function writeResult(pg: Client, row: any, result: GeoResult, queries: string[], totalTried: number): Promise<void> {
    const hasExistingCoords = row.latitude != null && row.longitude != null;
    const isGoogleSource = result.method === 'google_geocoding_v5';

    // Overwrite decision matrix per implementation plan v3:
    // 1. Google ROOFTOP/RANGE → always overwrite
    // 2. Non-Google → only write if currently null
    const shouldWriteCoords =
        (isGoogleSource && result.should_write_coords) ||
        (!hasExistingCoords && result.should_write_coords);

    if (result.status === 'hitl_review') {
        // GEOMETRIC_CENTER or APPROXIMATE → flag only, do NOT write coords
        await pg.query(`
            UPDATE public.iebc_offices SET
                geocode_status = 'hitl_review',
                geocode_method = $1,
                geocode_queries = $2,
                geocode_query = $3,
                total_queries_tried = $4,
                notes = COALESCE(notes, '') || ' [HITL: low-precision geocode flagged at ' || NOW()::text || ']',
                updated_at = NOW()
            WHERE id = $5
        `, [result.method, queries.join(' | '), queries[0], totalTried, row.id]);
        return;
    }

    if (shouldWriteCoords) {
        await pg.query(`
            UPDATE public.iebc_offices SET
                latitude = $1,
                longitude = $2,
                formatted_address = $3,
                geocode_method = $4,
                geocode_confidence = $5,
                geocode_status = $6,
                accuracy_meters = $7,
                result_type = $8,
                importance_score = $9,
                geocode_queries = $10,
                geocode_query = $11,
                successful_geocode_query = $12,
                total_queries_tried = $13,
                source = 'NASAKA Google Geocoding v5',
                verified = $14,
                notes = COALESCE(notes, '') || ' [GEOCODED: ' || NOW()::text || ']',
                updated_at = NOW()
            WHERE id = $15
        `, [
            result.lat, result.lng, result.address,
            result.method, result.confidence,
            result.status, result.accuracy_meters,
            result.result_type, result.importance,
            queries.join(' | '), queries[0], result.query_used,
            totalTried, result.confidence >= 0.85,
            row.id
        ]);
    } else {
        // Update metadata only (no coord overwrite)
        await pg.query(`
            UPDATE public.iebc_offices SET
                geocode_status = $1,
                geocode_method = $2,
                geocode_queries = $3,
                geocode_query = $4,
                total_queries_tried = $5,
                updated_at = NOW()
            WHERE id = $6
        `, [result.status, result.method, queries.join(' | '), queries[0], totalTried, row.id]);
    }
}

async function processBatch(pg: Client, rows: any[]): Promise<{ resolved: number; hitl: number; failed: number }> {
    let resolved = 0, hitl = 0, failed = 0;

    // Process with max 10 concurrent
    const chunks: any[][] = [];
    for (let i = 0; i < rows.length; i += MAX_CONCURRENT) {
        chunks.push(rows.slice(i, i + MAX_CONCURRENT));
    }

    const processedIds: number[] = [];

    for (const chunk of chunks) {
        await Promise.all(chunk.map(async (row) => {
            const { result, queries, totalTried } = await resolveRow(row, pg);
            processedIds.push(row.id);

            if (result) {
                await writeResult(pg, row, result, queries, totalTried);
                if (result.status === 'hitl_review') {
                    hitl++;
                    process.stdout.write(`  ~ [${row.id}] ${row.office_location?.substring(0, 40)} -> HITL (${result.location_type})\n`);
                } else {
                    resolved++;
                    process.stdout.write(`  + [${row.id}] ${row.office_location?.substring(0, 40)} -> ${result.method} (${result.confidence.toFixed(2)})\n`);
                }
            } else {
                await pg.query(`
                    UPDATE public.iebc_offices SET
                        geocode_status = 'failed',
                        geocode_queries = $1,
                        geocode_query = $2,
                        total_queries_tried = $3,
                        updated_at = NOW()
                    WHERE id = $4
                `, [queries.join(' | '), queries[0], totalTried, row.id]);
                failed++;
                process.stdout.write(`  x [${row.id}] ${row.office_location?.substring(0, 40)} -> FAILED\n`);
            }
        }));
        await new Promise(r => setTimeout(r, BASE_DELAY_MS));
    }

    // Phase 3: Automated Titan Cluster Audit
    await clusterAudit(pg, processedIds);

    return { resolved, hitl, failed };
}

async function main() {
    const pg = new Client({ connectionString: dbUrl });
    await pg.connect();
    console.log('[GEO-v5] Connected. Kenya Bounding Box active. HITL flagging active.\n');

    // Phase 0: Diaspora hard-coding (preserved from geocoder.ts)
    console.log('[GEO-v5] Phase 0: Hard-coding Diaspora embassies...');
    for (const [key, coords] of Object.entries(DIASPORA_MAP)) {
        await pg.query(`
            UPDATE public.iebc_offices SET
                latitude = $1, longitude = $2, formatted_address = $3,
                geocode_method = 'hardcoded', geocode_confidence = 1.0,
                geocode_status = 'verified', accuracy_meters = 10,
                result_type = 'ROOFTOP', importance_score = 1.0,
                geocode_query = $4, successful_geocode_query = $4,
                total_queries_tried = 1, source = 'NASAKA Embassy Hard-Code',
                verified = true, updated_at = NOW()
            WHERE county = 'DIASPORA' AND office_location ILIKE $5
              AND geocode_status = 'pending'
        `, [coords.lat, coords.lng, coords.address, `${key} Embassy Kenya`, `%${key}%`]);
    }
    console.log('[GEO-v5] Diaspora complete.\n');

    // Phase 1: Batch geocode
    let totalProcessed = 0, totalResolved = 0, totalHitl = 0, totalFailed = 0;
    let lastId = 0;

    while (true) {
        const { rows } = await pg.query(`
            SELECT id, office_location, clean_office_location, ward, constituency, county,
                   latitude, longitude, geocode_status, geocode_method
            FROM public.iebc_offices
            WHERE office_type = 'REGISTRATION_CENTRE'
              AND geocode_status IN ('pending', 'failed')
              AND county != 'DIASPORA'
              AND id > $1
            ORDER BY id
            LIMIT $2
        `, [lastId, BATCH_SIZE]);

        if (rows.length === 0) break;
        lastId = rows[rows.length - 1].id;

        console.log(`[GEO-v5] Processing batch of ${rows.length} (total: ${totalProcessed})...`);
        const { resolved, hitl, failed } = await processBatch(pg, rows);
        totalProcessed += rows.length;
        totalResolved += resolved;
        totalHitl += hitl;
        totalFailed += failed;

        console.log(`[GEO-v5] Batch done: ${resolved} OK, ${hitl} HITL, ${failed} FAIL | Total: ${totalProcessed}\n`);
        await new Promise(r => setTimeout(r, INTER_BATCH_DELAY_MS));
    }

    // Phase 2: Bbox violation audit
    const { rows: bboxViolations } = await pg.query(`
        SELECT id, office_location, latitude, longitude
        FROM public.iebc_offices
        WHERE office_type = 'REGISTRATION_CENTRE'
          AND latitude IS NOT NULL
          AND (latitude NOT BETWEEN $1 AND $2 OR longitude NOT BETWEEN $3 AND $4)
    `, [KE_LAT_MIN, KE_LAT_MAX, KE_LNG_MIN, KE_LNG_MAX]);

    if (bboxViolations.length > 0) {
        console.log(`\n[GEO-v5] WARNING: ${bboxViolations.length} bounding box violations found:`);
        for (const v of bboxViolations) {
            console.log(`  [${v.id}] ${v.office_location} | lat:${v.latitude} lng:${v.longitude}`);
            await pg.query(`UPDATE public.iebc_offices SET geocode_status = 'out_of_bounds' WHERE id = $1`, [v.id]);
        }
    } else {
        console.log('\n[GEO-v5] Bounding box check: 0 violations.');
    }

    // Final summary
    const { rows: [summary] } = await pg.query(`
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE geocode_status = 'verified') as verified,
            COUNT(*) FILTER (WHERE geocode_status = 'approximate') as approximate,
            COUNT(*) FILTER (WHERE geocode_status = 'hitl_review') as hitl,
            COUNT(*) FILTER (WHERE geocode_status = 'failed') as failed,
            COUNT(*) FILTER (WHERE geocode_status = 'out_of_bounds') as out_of_bounds,
            COUNT(*) FILTER (WHERE geocode_status = 'pending') as still_pending
        FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'
    `);

    console.log('\n[GEO-v5] ========= GEOCODING FINAL REPORT =========');
    console.log(`  Total:         ${summary.total}`);
    console.log(`  Verified:      ${summary.verified}`);
    console.log(`  Approximate:   ${summary.approximate}`);
    console.log(`  HITL Review:   ${summary.hitl}`);
    console.log(`  Failed:        ${summary.failed}`);
    console.log(`  Out of Bounds: ${summary.out_of_bounds}`);
    console.log(`  Still Pending: ${summary.still_pending}`);
    console.log('[GEO-v5] ===========================================\n');

    await pg.end();
}

main().catch(err => { console.error('[GEO-v5 FATAL]', err); process.exit(1); });
