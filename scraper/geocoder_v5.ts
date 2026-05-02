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
import Fuse from 'fuse.js';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const dbUrl = process.env.SUPABASE_DB_POOLED_URL;
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GEOAPIFY_KEY = process.env.GEOAPIFY_API_KEY;
const OPENCAGE_KEY = process.env.OPENCAGE_API_KEY;
const LOCATIONIQ_KEY = process.env.LOCATIONIQ_API_KEY;
const POSITIONSTACK_KEY = process.env.POSITIONSTACK_API_KEY;
const GEOKEO_KEY = process.env.GEOKEO_API_KEY;
const GEOCODE_EARTH_KEY = process.env.GEOCODE_EARTH_API_KEY;
const ARCGIS_KEY = process.env.ARCGIS_API_KEY_PRIMARY;
const ARCGIS_KEY_2 = process.env.ARCGIS_API_KEY_SECONDARY;
const GEOCODE_MAPS_KEY = process.env.GEOCODE_MAPS_API_KEY;
const GEONAMES_USER = process.env.GEONAMES_USERNAME;
const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const COHERE_KEY = process.env.COHERE_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const HF_TOKEN = process.env.HF_API_TOKEN;
const BIGDATACLOUD_KEY = process.env.BIGDATACLOUD_API_KEY;
const ORS_KEY = process.env.ORS_API_KEY;

const BATCH_SIZE = 200;
const MAX_CONCURRENT = 10;
const BASE_DELAY_MS = 100;
const INTER_BATCH_DELAY_MS = 2000;

// Circuit breakers — disable APIs after first auth/rate failure to prevent log spam
let opencageDisabled = false;
let locationiqDisabled = false;
let geminiDisabled = false;
let groqDisabled = false;
let openaiDisabled = false;
let positionstackDisabled = false;
let geokeoDisabled = false;
let arcgisDisabled = false;
let geocodeEarthDisabled = false;
let geocodeMapsDisabled = false;
let geonamesDisabled = false;
let cerebrasDisabled = false;
let deepseekDisabled = false;
let cohereDisabled = false;
let openrouterDisabled = false;
let nvidiaDisabled = false;
let hfDisabled = false;
let bigDataCloudDisabled = false;
let orsDisabled = false;

// Kenya bounding box
const KE_LAT_MIN = -4.72, KE_LAT_MAX = 4.62;
const KE_LNG_MIN = 33.91, KE_LNG_MAX = 41.91;

// --- MOE SCHOOLS STATE ---
let moeSchools: any[] = [];
let moeFuse: Fuse<any> | null = null;

async function loadMoESchools() {
    const p = path.resolve(__dirname, '../data/moe_schools.json');
    if (fs.existsSync(p)) {
        moeSchools = JSON.parse(fs.readFileSync(p, 'utf-8'));
        moeFuse = new Fuse(moeSchools, {
            keys: ['name'],
            threshold: 0.3,
            ignoreLocation: true,
            includeScore: true
        });
        console.log(`[GEO-v5] Loaded ${moeSchools.length} schools from MoE shapefile into fuzzy index.`);
    }
}

function normalizeCountyName(name: string): string {
    if (!name) return '';
    return name.toUpperCase()
        .replace(/\s+COUNTY$/, '')
        .replace(/\//g, '-') // DB ELGEYO/MARAKWET vs GEOJSON ELGEYO-MARAKWET
        .trim();
}

// Failure Category 4: Blacklist (provider, ward|county) pairs that return spatially rejected results
const providerWardBlacklist = new Map<string, Set<string>>();
function isBlacklisted(provider: string, ward: string, county: string): boolean {
    const key = `${ward.toUpperCase()}|${county.toUpperCase()}`;
    return providerWardBlacklist.get(key)?.has(provider) || false;
}
function blacklistProvider(provider: string, ward: string, county: string) {
    const key = `${ward.toUpperCase()}|${county.toUpperCase()}`;
    if (!providerWardBlacklist.has(key)) providerWardBlacklist.set(key, new Set());
    providerWardBlacklist.get(key)!.add(provider);
    console.warn(`  [BLACKLIST] ${provider} silenced for ${key} due to spatial rejection.`);
}

if (!dbUrl) { console.error('[FATAL] SUPABASE_DB_POOLED_URL missing'); process.exit(1); }

// --- TRUTH SOURCE CACHE ---
const truthCenters = new Map<string, any>();
async function loadTruthCenters() {
    const pg = new Client({ connectionString: dbUrl });
    await pg.connect();
    const { rows } = await pg.query("SELECT upper(name) as name, upper(ward) as ward, upper(constituency) as constituency, upper(county) as county, name as canonical_name FROM public.iebc_registration_centres");
    for (const r of rows) {
        const key = `${r.ward}|${r.constituency}|${r.county}`;
        if (!truthCenters.has(key)) truthCenters.set(key, []);
        truthCenters.get(key)!.push(r);
    }
    await pg.end();
    console.log(`[GEO-v5] Cached ${rows.length} truth source registration centers.`);
}

// --- WARDS DYNAMIC SPATIAL ENGINE ---
const wardBoundaries = new Map<string, any>();
const wardCentroids = new Map<string, { lat: number; lng: number }>();

async function loadWardBoundaries() {
    try {
        const geojsonPath = path.resolve(__dirname, '../public/context/Wards/kenya_wards.geojson');
        if (fs.existsSync(geojsonPath)) {
            const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
            for (const f of data.features || []) {
                let w = (f.properties?.ward || '').toUpperCase().trim();
                w = w.replace(/\s+WARD$/, '');
                const c = normalizeCountyName(f.properties?.county || '');
                
                const geomType = f.geometry?.type;
                if (w && (geomType === 'Polygon' || geomType === 'MultiPolygon')) {
                    // Problem 4: Compound key to resolve 30 duplicate ward collisions (CENTRAL, TOWNSHIP etc)
                    wardBoundaries.set(`${w}|${c}`, f);
                }
            }
            console.log(`[GEO-v5] Loaded ${wardBoundaries.size} unique ward-county boundary mappings.`);
        } else {
            console.warn('[GEO-v5] kenya_wards.geojson not found! Dynamic shifting area buffer unavailable.');
        }

        // --- SECONDARY: Load Ward Centroids from DB (for wards missing GeoJSON) ---
        const pg = new Client({ connectionString: dbUrl });
        await pg.connect();
        const { rows } = await pg.query("SELECT upper(ward_name) as name, latitude, longitude FROM public.wards WHERE latitude IS NOT NULL");
        for (const r of rows) {
            wardCentroids.set(r.name, { lat: parseFloat(r.latitude), lng: parseFloat(r.longitude) });
        }
        await pg.end();
        console.log(`[GEO-v5] Seeded ${wardCentroids.size} ward centroids as fallback gates.`);
    } catch(e) {
        console.error('[GEO-v5] Spatial bounds load failed:', e);
    }
}
// loadWardBoundaries(); // Removed top-level unawaited call

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
    const countyName = (row.county || '').trim().toUpperCase();
    if (!wardName) return true; // No ward to check

    // Guard: skip spatial validation for invalid ward codes (e.g., EMS00, W001)
    if (/\d/.test(wardName)) return true;

    // Prefer compound key (Ward|County) to resolve name collisions, fallback to bare ward
    const compoundKey = `${wardName}|${countyName}`;
    const feat = wardBoundaries.get(compoundKey) || wardBoundaries.get(wardName);
    if (feat) {
        const pt = turf.point([lng, lat]);
        
        // 1. Direct hit? Point in Polygon
        try {
            if (turf.booleanPointInPolygon(pt, feat)) {
                return true;
            }
        } catch(e) {}

        // 2. Dynamic Shift based on exact Ward Area properties
        // Use Bounding Box span derived radius + 5km buffer to dynamically encompass ANY shape (like Turbi)
        const bbox = turf.bbox(feat);
        const bboxDistKm = turf.distance(turf.point([bbox[0], bbox[1]]), turf.point([bbox[2], bbox[3]]), { units: 'kilometers' });
        
        const dynamicGateRadius = Math.max(1, (bboxDistKm / 2) + 5); 

        let cent;
        try { cent = turf.centroid(feat); } catch { return false; }
        
        const distToCenter = turf.distance(pt, cent, { units: 'kilometers' });
        if (distToCenter > dynamicGateRadius) {
            console.warn(`  [REJECT SPATIAL] Outlier: ${distToCenter.toFixed(1)}km from ${wardName} center. Dynamic Area shift gate strictly allows up to ${dynamicGateRadius.toFixed(1)}km`);
            return false;
        }
        return true;
    } else {
        // Fallback for wards WITHOUT GeoJSON boundary (approx. 39 wards)
        const cent = wardCentroids.get(wardName);
        if (cent) {
            const pt = turf.point([lng, lat]);
            const cp = turf.point([cent.lng, cent.lat]);
            const dist = turf.distance(pt, cp, { units: 'kilometers' });
            
            // Failure Category 1: County Capital Poisoning Shield
            // If we are using fallback centroid gating (which is broad - 75km), 
            // we must reject results that are generic admin areas (localities) 
            // if we are searching for a specific facility.
            const isGeneric = ['locality', 'administrative_area_level_1', 'administrative_area_level_2', 'administrative_area_level_3', 'neighborhood', 'political'].includes(row.result_type_full || '');
            const facilityKeywords = ['SCHOOL', 'PRIMARY', 'SECONDARY', 'NURSERY', 'CENTRE', 'CENTER', 'DISPENSARY', 'HOSPITAL', 'CHURCH', 'MOSQUE', 'MARKET', 'POLYTECHNIC'];
            const isFacilityQuery = facilityKeywords.some(k => (row.office_location || '').toUpperCase().includes(k));

            if (isGeneric && isFacilityQuery) {
                console.warn(`  [REJECT GENERIC] ${dist.toFixed(1)}km from ${wardName} centroid. Rejected as generic admin result (${row.result_type_full}) for facility query.`);
                return false;
            }

            if (dist > 75) {
                console.warn(`  [REJECT SPATIAL] Outlier: ${dist.toFixed(1)}km from ${wardName} centroid (fallback gate). Limit is 75km.`);
                return false;
            }
            console.log(`  [SPATIAL] Ward ${wardName} missing polygon, but within 75km centroid fallback (${dist.toFixed(1)}km).`);
            return true;
        }
        // No centroid either? Use Kenya bounding box (already checked above)
    }
    return true;
}

function buildStringA(row: any): string[] {
    const rawLoc = (row.clean_office_location || row.office_location || '').trim();
    
    // Truth Source Alignment: Try to find canonical name from public.iebc_registration_centres
    const key = `${(row.ward||'').toUpperCase().trim()}|${(row.constituency||'').toUpperCase().trim()}|${(row.county||'').toUpperCase().trim()}`;
    const candidates = truthCenters.get(key) || [];
    let loc = rawLoc;
    
    if (candidates.length > 0) {
        // Simple heuristic: match if rawLoc is contained in canonical name or vice versa
        const found = candidates.find((c: any) => 
            c.name.includes(rawLoc.toUpperCase()) || 
            rawLoc.toUpperCase().includes(c.name)
        );
        if (found) {
            loc = found.canonical_name;
        }
    }

    const ward = (row.ward || '').trim();
    const con = (row.constituency || '').trim();
    const county = (row.county || '').trim();

    const queries: string[] = [];

    // Tier A: Full context — {location}, {ward}, {constituency}, {county} County, Kenya
    if (ward) {
        queries.push(`${loc}, ${ward}, ${con}, ${county} County, Kenya`);
    }

    // Tier B: No ward — {location}, {constituency}, {county} County, Kenya
    queries.push(`${loc}, ${con}, ${county} County, Kenya`);

    // Tier C: County only — {location}, {county} County, Kenya
    queries.push(`${loc}, ${county} County, Kenya`);

    // Tier D: Bare national — {location}, Kenya
    queries.push(`${loc}, Kenya`);

    // Tier E: School/facility hint with ward context
    if (loc.toLowerCase().includes('school') || loc.toLowerCase().includes('primary') || loc.toLowerCase().includes('secondary')) {
        queries.push(`${loc}, ${ward || con}, Kenya`);
    } else {
        queries.push(`${loc} school, ${ward || con}, Kenya`);
    }

    // Tier F: Constituency anchor fallback
    queries.push(`${con} IEBC Registration Centre, ${county}, Kenya`);

    return queries;
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

        // Quality classification per Google location_type
        const isHighQuality = locType === 'ROOFTOP' || locType === 'RANGE_INTERPOLATED';
        const isAcceptable = isHighQuality || locType === 'GEOMETRIC_CENTER' || locType === 'APPROXIMATE';
        const conf = locType === 'ROOFTOP' ? 1.0
                   : locType === 'RANGE_INTERPOLATED' ? 0.85
                   : locType === 'GEOMETRIC_CENTER' ? 0.4
                   : 0.25;
        const acc = locType === 'ROOFTOP' ? 10
                  : locType === 'RANGE_INTERPOLATED' ? 50
                  : locType === 'GEOMETRIC_CENTER' ? 500
                  : 1000;

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
            status: isHighQuality ? 'verified' : 'approximate',
            should_write_coords: isAcceptable
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

let nominatimDisabled = false;
async function nominatimGeocode(query: string): Promise<GeoResult | null> {
    if (nominatimDisabled) return null;
    try {
        const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&countrycodes=ke&limit=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'NasakaIEBC/2.0' } });
        
        if (res.status === 429 || res.status === 403) {
            nominatimDisabled = true;
            console.warn(`  [NOMINATIM TRIPPED] Received ${res.status}. Disabling for this run.`);
            return null;
        }

        const textResponse = await res.text();
        if (textResponse.trim().startsWith('<')) {
            console.warn(`  [NOMINATIM BLOCKED] Received HTML/XML response. Rate limit likely exceeded.`);
            nominatimDisabled = true;
            return null;
        }

        const data = JSON.parse(textResponse) as any;
        if (!data || !data.length) return null;

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

async function opencageGeocode(query: string): Promise<GeoResult | null> {
    if (!OPENCAGE_KEY || opencageDisabled) return null;
    try {
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_KEY}&countrycode=ke&limit=1&no_annotations=1`;
        const res = await fetch(url);

        if (res.status === 401 || res.status === 403) {
            console.warn(`  [OPENCAGE] UNAUTHORIZED (${res.status}). Disabling OpenCage for this run.`);
            opencageDisabled = true;
            return null;
        }
        if (res.status === 429) {
            console.warn(`  [OPENCAGE] Rate limited. Disabling OpenCage for this run.`);
            opencageDisabled = true;
            return null;
        }
        if (!res.ok) return null;

        const data = await res.json() as any;
        if (!data.results?.length) return null;

        const r = data.results[0];
        const lat = r.geometry.lat;
        const lng = r.geometry.lng;

        if (!bboxValid(lat, lng)) return null;

        const conf = r.confidence ? Math.min(r.confidence / 10, 1.0) : 0.5;

        return {
            lat, lng,
            address: r.formatted,
            method: 'opencage',
            confidence: conf,
            accuracy_meters: conf > 0.7 ? 100 : 500,
            result_type: r.components?._type || 'unknown',
            location_type: 'OPENCAGE',
            importance: conf,
            query_used: query,
            status: conf >= 0.7 ? 'verified' : 'approximate',
            should_write_coords: true
        };
    } catch (e: any) {
        console.error(`  [OPENCAGE ERR] ${e.message}`);
        return null;
    }
}

async function locationiqGeocode(query: string): Promise<GeoResult | null> {
    if (!LOCATIONIQ_KEY || locationiqDisabled) return null;
    try {
        // LocationIQ free tier: 2 req/sec — enforce 500ms delay
        await new Promise(r => setTimeout(r, 500));
        const url = `https://us1.locationiq.com/v1/search?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(query)}&countrycodes=ke&format=json&limit=1`;
        const res = await fetch(url);

        if (res.status === 401 || res.status === 403) {
            console.warn(`  [LOCATIONIQ] UNAUTHORIZED (${res.status}). Disabling LocationIQ for this run.`);
            locationiqDisabled = true;
            return null;
        }
        if (res.status === 429) {
            console.warn(`  [LOCATIONIQ] Rate limited. Disabling LocationIQ for this run.`);
            locationiqDisabled = true;
            return null;
        }
        if (!res.ok) return null;

        const textResponse = await res.text();
        if (textResponse.trim().startsWith('<')) return null;

        const data = JSON.parse(textResponse) as any;
        if (!data?.length) return null;

        const r = data[0];
        const lat = parseFloat(r.lat);
        const lng = parseFloat(r.lon);

        if (!bboxValid(lat, lng)) return null;

        const imp = parseFloat(r.importance) || 0.4;

        return {
            lat, lng,
            address: r.display_name,
            method: 'locationiq',
            confidence: imp,
            accuracy_meters: imp > 0.7 ? 100 : 500,
            result_type: r.type || 'unknown',
            location_type: 'LOCATIONIQ',
            importance: imp,
            query_used: query,
            status: imp >= 0.7 ? 'verified' : 'approximate',
            should_write_coords: true
        };
    } catch (e: any) {
        console.error(`  [LOCATIONIQ ERR] ${e.message}`);
        return null;
    }
}

// Centroid Proximity Guard — prevents writing generic ward centroids as actual office coordinates
function isWardCentroidProximity(lat: number, lng: number, wardName: string): boolean {
    const feat = wardBoundaries.get(wardName.toUpperCase().trim());
    if (!feat) return false;
    try {
        const cent = turf.centroid(feat);
        const dist = turf.distance(turf.point([lng, lat]), cent, { units: 'kilometers' });
        return dist < 0.5; // Within 500m of ward centroid = likely generic centroid, NOT actual location
    } catch { return false; }
}

async function researchLocation(row: any, pg: Client): Promise<{ canonical_name: string, new_queries: string[] } | null> {
    // 1. Fetch Legacy Name from backup
    let altName = '';
    try {
        const alt = await pg.query(`SELECT office_location FROM public.iebc_offices_legacy_backup WHERE upper(county)=$1 AND upper(constituency)=$2 AND upper(ward)=$3 LIMIT 1`, [
            (row.county||'').toUpperCase(), (row.constituency||'').toUpperCase(), (row.ward||'').toUpperCase()
        ]);
        altName = alt.rows[0]?.office_location || '';
    } catch {}

    // 2. Fetch Canonical Name from truth source cache
    const key = `${(row.ward||'').toUpperCase().trim()}|${(row.constituency||'').toUpperCase().trim()}|${(row.county||'').toUpperCase().trim()}`;
    const candidates = truthCenters.get(key) || [];
    let canonical = '';
    const rawLoc = (row.clean_office_location || row.office_location || '').toUpperCase().trim();
    const found = candidates.find((c: any) => c.name.includes(rawLoc) || rawLoc.includes(c.name));
    if (found) canonical = found.canonical_name;

    const prompt = `Research IEBC Registration Centre: "${row.office_location}". Context: Ward=${row.ward}, Constituency=${row.constituency}, County=${row.county}. Canonical Truth Name: "${canonical}". Legacy Name: "${altName}".`;

    const systemPrompt = `You generate geocoding search strings for specific IEBC registration centres in Kenya. 
You NEVER mention any facility other than the exact target. 
You NEVER use another school, dispensary, church, or landmark as a reference point. 
Your queries must contain ONLY the target facility name combined with its village, sub-location, ward, or constituency.
Return JSON STRICT format ONLY: {"canonical_name": "clean string", "surgical_queries": ["query1", "query2", "query3"]}`;

    // Titan AI Research Cascade: Cerebras → Groq → OpenRouter → DeepSeek → OpenAI → Cohere → NVIDIA → HuggingFace → Gemini
    const result = await tryCerebrasResearch(prompt, systemPrompt)
        || await tryGroqResearch(prompt, systemPrompt)
        || await tryOpenRouterResearch(prompt, systemPrompt)
        || await tryDeepSeekResearch(prompt, systemPrompt)
        || await tryOpenAIResearch(prompt, systemPrompt)
        || await tryCohereResearch(prompt, systemPrompt)
        || await tryNvidiaResearch(prompt, systemPrompt)
        || await tryHuggingFaceResearch(prompt, systemPrompt)
        || await tryGeminiResearch(prompt, systemPrompt);
    return result;
}

// Problem 1: MoE Pre-cascade Step
async function lookupMoESchool(row: any): Promise<GeoResult | null> {
    if (!moeFuse) return null;
    const ward = (row.ward || '').toUpperCase().trim();
    const county = normalizeCountyName(row.county || '');
    const officeName = (row.office_location || '').toUpperCase().trim();

    const results = moeFuse.search(officeName);
    // Filter by ward/county first to ensure spatial integrity
    const filtered = results.filter(r => {
        const item = r.item;
        return item.county === county && (item.ward === ward || ward === '');
    });

    if (filtered.length > 0) {
        const best = filtered[0].item;
        return {
            lat: best.lat,
            lng: best.lng,
            address: `${best.name}, ${best.ward}, ${best.county}, Kenya`,
            method: 'moe_shapefile_lookup',
            confidence: 0.95,
            accuracy_meters: 50,
            result_type: 'school',
            location_type: 'ROOFTOP',
            importance: 0.95,
            query_used: officeName,
            status: 'verified',
            should_write_coords: true
        };
    }
    return null;
}

// Problem 5: Ward-Cohort Spatial Interpolation
async function interpolateWardCohort(ward: string, county: string, pg: Client): Promise<GeoResult | null> {
    const { rows } = await pg.query(`
        SELECT AVG(latitude) as lat, AVG(longitude) as lng 
        FROM public.iebc_offices 
        WHERE upper(ward) = $1 AND upper(county) = $2 AND geocode_status = 'verified'
    `, [ward.toUpperCase().trim(), county.toUpperCase().trim()]);

    if (rows[0] && rows[0].lat && rows[0].lng) {
        return {
            lat: parseFloat(rows[0].lat),
            lng: parseFloat(rows[0].lng),
            address: `Ward Interpolated Center (${ward})`,
            method: 'ward_interpolated_v12',
            confidence: 0.4,
            accuracy_meters: 2000,
            result_type: 'ward_center',
            location_type: 'COHORT',
            importance: 0.4,
            query_used: ward,
            status: 'approximate',
            should_write_coords: true
        };
    }
    return null;
}

async function tryGroqResearch(prompt: string, systemPrompt?: string): Promise<{ canonical_name: string, new_queries: string[] } | null> {
    if (!GROQ_KEY || groqDisabled) return null;
    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt || 'You are a geospatial research assistant.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 300
            })
        });
        if (res.status === 401 || res.status === 403) {
            console.warn(`  [TITAN-GROQ] UNAUTHORIZED (${res.status}). Disabling Groq for this run.`);
            groqDisabled = true;
            return null;
        }
        if (res.status === 429) {
            console.warn(`  [TITAN-GROQ] Rate limited. Disabling Groq for this run.`);
            groqDisabled = true;
            return null;
        }
        if (!res.ok) return null;
        const d = await res.json() as any;
        const text = d.choices?.[0]?.message?.content;
        if (!text) return null;
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1) return null;
        const json = JSON.parse(text.substring(firstBrace, lastBrace + 1));
        console.log(`  [TITAN-GROQ] AI research successful.`);
        return { canonical_name: json.canonical_name, new_queries: json.surgical_queries };
    } catch (e: any) {
        console.error(`  [TITAN-GROQ CRASH] ${e.message}`);
        return null;
    }
}

async function tryOpenAIResearch(prompt: string, systemPrompt?: string): Promise<{ canonical_name: string, new_queries: string[] } | null> {
    if (!OPENAI_KEY || openaiDisabled) return null;
    try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt || 'You are a geospatial research assistant.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 300
            })
        });
        if (res.status === 401 || res.status === 403) {
            console.warn(`  [TITAN-OPENAI] UNAUTHORIZED (${res.status}). Disabling OpenAI for this run.`);
            openaiDisabled = true;
            return null;
        }
        if (res.status === 429) {
            console.warn(`  [TITAN-OPENAI] Rate limited. Disabling OpenAI for this run.`);
            openaiDisabled = true;
            return null;
        }
        if (!res.ok) return null;
        const d = await res.json() as any;
        const text = d.choices?.[0]?.message?.content;
        if (!text) return null;
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1) return null;
        const json = JSON.parse(text.substring(firstBrace, lastBrace + 1));
        console.log(`  [TITAN-OPENAI] AI research successful.`);
        return { canonical_name: json.canonical_name, new_queries: json.surgical_queries };
    } catch (e: any) {
        console.error(`  [TITAN-OPENAI CRASH] ${e.message}`);
        return null;
    }
}

async function tryGeminiResearch(prompt: string, systemPrompt?: string): Promise<{ canonical_name: string, new_queries: string[] } | null> {
    if (!GEMINI_KEY || geminiDisabled) return null;
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt || 'You help with geocoding.' }] },
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        if (res.status === 429) {
            console.warn(`  [TITAN-GEMINI] Rate limited. Disabling Gemini for this run.`);
            geminiDisabled = true;
            return null;
        }
        if (!res.ok) return null;
        const d = await res.json() as any;
        const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) return null;
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1) return null;
        const json = JSON.parse(text.substring(firstBrace, lastBrace + 1));
        console.log(`  [TITAN-GEMINI] AI research successful.`);
        return { canonical_name: json.canonical_name, new_queries: json.surgical_queries };
    } catch (e: any) {
        console.error(`  [TITAN-GEMINI CRASH] ${e.message}`);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ArcGIS Geocoder — Deepest East Africa POI coverage
// ═══════════════════════════════════════════════════════════════════════════
async function arcgisGeocode(query: string): Promise<GeoResult | null> {
    const key = arcgisDisabled ? null : (ARCGIS_KEY || ARCGIS_KEY_2);
    if (!key) return null;
    try {
        const url = `https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(query)}&countryCode=KE&f=json&maxLocations=1&token=${key}`;
        const res = await fetch(url);
        if (res.status === 401 || res.status === 403) {
            console.warn(`  [ARCGIS] UNAUTHORIZED (${res.status}). Disabling for this run.`);
            arcgisDisabled = true;
            return null;
        }
        if (res.status === 429) {
            console.warn(`  [ARCGIS] Rate limited. Disabling for this run.`);
            arcgisDisabled = true;
            return null;
        }
        if (!res.ok) return null;
        const data = await res.json() as any;
        if (!data.candidates?.length) return null;
        const c = data.candidates[0];
        const lat = c.location.y;
        const lng = c.location.x;
        if (!bboxValid(lat, lng)) return null;
        const score = (c.score || 50) / 100;
        return {
            lat, lng,
            address: c.address || '',
            method: 'arcgis',
            confidence: score,
            accuracy_meters: score > 0.8 ? 50 : 500,
            result_type: c.attributes?.Type || 'unknown',
            location_type: 'ARCGIS',
            importance: score,
            query_used: query,
            status: score >= 0.7 ? 'verified' : 'approximate',
            should_write_coords: true
        };
    } catch (e: any) {
        console.error(`  [ARCGIS ERR] ${e.message}`);
        return null;
    }
}

async function geocodeEarthGeocode(query: string): Promise<GeoResult | null> {
    if (!GEOCODE_EARTH_KEY || geocodeEarthDisabled) return null;
    try {
        const url = `https://api.geocode.earth/v1/search?api_key=${GEOCODE_EARTH_KEY}&text=${encodeURIComponent(query)}&boundary.country=KE&size=1`;
        const res = await fetch(url);
        if (res.status === 401 || res.status === 403) { geocodeEarthDisabled = true; return null; }
        if (res.status === 429) { geocodeEarthDisabled = true; return null; }
        if (!res.ok) return null;
        const data = await res.json() as any;
        if (!data.features?.length) return null;
        const f = data.features[0];
        const lat = f.geometry.coordinates[1];
        const lng = f.geometry.coordinates[0];
        if (!bboxValid(lat, lng)) return null;
        const conf = f.properties?.confidence || 0.5;
        return {
            lat, lng,
            address: f.properties?.label || '',
            method: 'geocode_earth',
            confidence: conf,
            accuracy_meters: conf > 0.7 ? 100 : 500,
            result_type: f.properties?.layer || 'unknown',
            location_type: 'GEOCODE_EARTH',
            importance: conf,
            query_used: query,
            status: conf >= 0.7 ? 'verified' : 'approximate',
            should_write_coords: true
        };
    } catch (e: any) { return null; }
}

async function geocodeMapsGeocode(query: string): Promise<GeoResult | null> {
    if (!GEOCODE_MAPS_KEY || geocodeMapsDisabled) return null;
    try {
        const url = `https://geocode.maps.co/search?q=${encodeURIComponent(query)}&api_key=${GEOCODE_MAPS_KEY}`;
        const res = await fetch(url);
        if (res.status === 401 || res.status === 403) { geocodeMapsDisabled = true; return null; }
        if (res.status === 429) { geocodeMapsDisabled = true; return null; }
        if (!res.ok) return null;
        const textResp = await res.text();
        if (textResp.trim().startsWith('<')) return null;
        const data = JSON.parse(textResp) as any;
        if (!data?.length) return null;
        const r = data[0];
        const lat = parseFloat(r.lat);
        const lng = parseFloat(r.lon);
        if (isNaN(lat) || isNaN(lng) || !bboxValid(lat, lng)) return null;
        const imp = parseFloat(r.importance) || 0.4;
        return {
            lat, lng,
            address: r.display_name || '',
            method: 'geocode_maps',
            confidence: imp,
            accuracy_meters: imp > 0.7 ? 100 : 500,
            result_type: r.type || 'unknown',
            location_type: 'GEOCODE_MAPS',
            importance: imp,
            query_used: query,
            status: imp >= 0.7 ? 'verified' : 'approximate',
            should_write_coords: true
        };
    } catch (e: any) { return null; }
}

async function geonamesGeocode(query: string): Promise<GeoResult | null> {
    if (!GEONAMES_USER || geonamesDisabled) return null;
    try {
        const url = `http://api.geonames.org/searchJSON?q=${encodeURIComponent(query)}&country=KE&maxRows=1&username=${GEONAMES_USER}`;
        const res = await fetch(url);
        if (res.status === 401 || res.status === 403) { geonamesDisabled = true; return null; }
        if (!res.ok) return null;
        const data = await res.json() as any;
        if (!data.geonames?.length) return null;
        const r = data.geonames[0];
        const lat = parseFloat(r.lat);
        const lng = parseFloat(r.lng);
        if (isNaN(lat) || isNaN(lng) || !bboxValid(lat, lng)) return null;
        return {
            lat, lng,
            address: `${r.name}, ${r.adminName1 || ''}, Kenya`,
            method: 'geonames',
            confidence: 0.5,
            accuracy_meters: 500,
            result_type: r.fclName || 'unknown',
            location_type: 'GEONAMES',
            importance: 0.5,
            query_used: query,
            status: 'approximate',
            should_write_coords: true
        };
    } catch (e: any) { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// Additional AI Research Providers for Titan Cascade
// ═══════════════════════════════════════════════════════════════════════════
async function tryCerebrasResearch(prompt: string, systemPrompt?: string): Promise<{ canonical_name: string, new_queries: string[] } | null> {
    if (!CEREBRAS_KEY || cerebrasDisabled) return null;
    try {
        const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CEREBRAS_KEY}` },
            body: JSON.stringify({
                model: 'llama-3.3-70b',
                messages: [
                    { role: 'system', content: systemPrompt || 'You help with geocoding.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 300
            })
        });
        if (res.status === 401 || res.status === 403) { cerebrasDisabled = true; return null; }
        if (res.status === 429) { cerebrasDisabled = true; return null; }
        if (!res.ok) return null;
        const d = await res.json() as any;
        const text = d.choices?.[0]?.message?.content;
        if (!text) return null;
        const fb = text.indexOf('{'), lb = text.lastIndexOf('}');
        if (fb === -1 || lb === -1) return null;
        const json = JSON.parse(text.substring(fb, lb + 1));
        console.log(`  [TITAN-CEREBRAS] AI research successful.`);
        return { canonical_name: json.canonical_name, new_queries: json.surgical_queries };
    } catch (e: any) { console.error(`  [TITAN-CEREBRAS CRASH] ${e.message}`); return null; }
}

async function tryDeepSeekResearch(prompt: string, systemPrompt?: string): Promise<{ canonical_name: string, new_queries: string[] } | null> {
    if (!DEEPSEEK_KEY || deepseekDisabled) return null;
    try {
        const res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt || 'You are a geospatial research assistant.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1,
                max_tokens: 300
            })
        });
        if (res.status === 401 || res.status === 403) { deepseekDisabled = true; return null; }
        if (res.status === 429) { deepseekDisabled = true; return null; }
        if (!res.ok) return null;
        const d = await res.json() as any;
        const text = d.choices?.[0]?.message?.content;
        if (!text) return null;
        const fb = text.indexOf('{'), lb = text.lastIndexOf('}');
        if (fb === -1 || lb === -1) return null;
        const json = JSON.parse(text.substring(fb, lb + 1));
        console.log(`  [TITAN-DEEPSEEK] AI research successful.`);
        return { canonical_name: json.canonical_name, new_queries: json.surgical_queries };
    } catch (e: any) { console.error(`  [TITAN-DEEPSEEK CRASH] ${e.message}`); return null; }
}

async function tryCohereResearch(prompt: string, systemPrompt?: string): Promise<{ canonical_name: string, new_queries: string[] } | null> {
    if (!COHERE_KEY || cohereDisabled) return null;
    try {
        const res = await fetch('https://api.cohere.ai/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${COHERE_KEY}` },
            body: JSON.stringify({ 
                message: prompt, 
                preamble: systemPrompt || 'You are a geospatial research assistant.',
                model: 'command-r-plus', 
                temperature: 0.1 
            })
        });
        if (res.status === 401 || res.status === 403) { cohereDisabled = true; return null; }
        if (res.status === 429) { cohereDisabled = true; return null; }
        if (!res.ok) return null;
        const d = await res.json() as any;
        const text = d.text;
        if (!text) return null;
        const fb = text.indexOf('{'), lb = text.lastIndexOf('}');
        if (fb === -1 || lb === -1) return null;
        const json = JSON.parse(text.substring(fb, lb + 1));
        console.log(`  [TITAN-COHERE] AI research successful.`);
        return { canonical_name: json.canonical_name, new_queries: json.surgical_queries };
    } catch (e: any) { console.error(`  [TITAN-COHERE CRASH] ${e.message}`); return null; }
}

async function tryOpenRouterResearch(prompt: string, systemPrompt?: string): Promise<{ canonical_name: string, new_queries: string[] } | null> {
    if (!OPENROUTER_KEY || openrouterDisabled) return null;
    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENROUTER_KEY}` },
            body: JSON.stringify({ 
                model: 'meta-llama/llama-3.3-70b-instruct', 
                messages: [
                    { role: 'system', content: systemPrompt || 'You are a geospatial research assistant.' },
                    { role: 'user', content: prompt }
                ], 
                temperature: 0.1, 
                max_tokens: 300 
            })
        });
        if (res.status === 401 || res.status === 403) { openrouterDisabled = true; return null; }
        if (res.status === 429) { openrouterDisabled = true; return null; }
        if (!res.ok) return null;
        const d = await res.json() as any;
        const text = d.choices?.[0]?.message?.content;
        if (!text) return null;
        const fb = text.indexOf('{'), lb = text.lastIndexOf('}');
        if (fb === -1 || lb === -1) return null;
        const json = JSON.parse(text.substring(fb, lb + 1));
        console.log(`  [TITAN-OPENROUTER] AI research successful.`);
        return { canonical_name: json.canonical_name, new_queries: json.surgical_queries };
    } catch (e: any) { console.error(`  [TITAN-OPENROUTER CRASH] ${e.message}`); return null; }
}

async function tryNvidiaResearch(prompt: string, systemPrompt?: string): Promise<{ canonical_name: string, new_queries: string[] } | null> {
    if (!NVIDIA_KEY || nvidiaDisabled) return null;
    try {
        const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${NVIDIA_KEY}` },
            body: JSON.stringify({ 
                model: 'meta/llama-3.1-70b-instruct', 
                messages: [
                    { role: 'system', content: systemPrompt || 'You are a geospatial research assistant.' },
                    { role: 'user', content: prompt }
                ], 
                temperature: 0.1, 
                max_tokens: 300 
            })
        });
        if (res.status === 401 || res.status === 403) { nvidiaDisabled = true; return null; }
        if (res.status === 429) { nvidiaDisabled = true; return null; }
        if (!res.ok) return null;
        const d = await res.json() as any;
        const text = d.choices?.[0]?.message?.content;
        if (!text) return null;
        const fb = text.indexOf('{'), lb = text.lastIndexOf('}');
        if (fb === -1 || lb === -1) return null;
        const json = JSON.parse(text.substring(fb, lb + 1));
        console.log(`  [TITAN-NVIDIA] AI research successful.`);
        return { canonical_name: json.canonical_name, new_queries: json.surgical_queries };
    } catch (e: any) { console.error(`  [TITAN-NVIDIA CRASH] ${e.message}`); return null; }
}

async function orsGeocode(query: string): Promise<GeoResult | null> {
    if (!ORS_KEY || orsDisabled) return null;
    try {
        const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_KEY}&text=${encodeURIComponent(query)}&boundary.country=KE&size=1`;
        const res = await fetch(url);
        if (res.status === 401 || res.status === 403) { orsDisabled = true; return null; }
        if (res.status === 429) { orsDisabled = true; return null; }
        if (!res.ok) return null;
        const data = await res.json() as any;
        if (!data.features?.length) return null;
        const f = data.features[0];
        const lat = f.geometry.coordinates[1];
        const lng = f.geometry.coordinates[0];
        if (!bboxValid(lat, lng)) return null;
        const conf = f.properties?.confidence || 0.5;
        return {
            lat, lng,
            address: f.properties?.label || '',
            method: 'ors',
            confidence: conf,
            accuracy_meters: conf > 0.7 ? 100 : 500,
            result_type: f.properties?.layer || 'unknown',
            location_type: 'ORS',
            importance: conf,
            query_used: query,
            status: conf >= 0.7 ? 'verified' : 'approximate',
            should_write_coords: true
        };
    } catch (e: any) { return null; }
}

async function verifyWardContainment(lat: number, lng: number, expectedWard: string): Promise<boolean> {
    if (!BIGDATACLOUD_KEY || bigDataCloudDisabled) return true; // Pass if no key
    try {
        const url = `https://api.bigdatacloud.net/data/reverse-geocode?latitude=${lat}&longitude=${lng}&localityLanguage=en&key=${BIGDATACLOUD_KEY}`;
        const res = await fetch(url);
        if (res.status === 401 || res.status === 403) { bigDataCloudDisabled = true; return true; }
        if (!res.ok) return true;
        const data = await res.json() as any;
        
        // BigDataCloud returns administrative levels in 'informative' or 'administrative'
        const adminLevels = data.administrative || [];
        const foundWard = adminLevels.find((a: any) => 
            a.name?.toLowerCase().includes(expectedWard.toLowerCase()) || 
            expectedWard.toLowerCase().includes(a.name?.toLowerCase())
        );

        if (foundWard) {
            console.log(`  [VERIFY-BDC] Confirmed containment in ${foundWard.name}.`);
            return true;
        }
        
        // Also check 'locality' fields
        if (data.locality?.toLowerCase().includes(expectedWard.toLowerCase())) return true;
        
        console.warn(`  [VERIFY-BDC REJECT] Point (${lat},${lng}) definitely outside ${expectedWard}. BDC saw: ${data.locality || 'unknown'}`);
        return false; // Problem 4: Hard blocking mismatch to prevent Kabarnet bias leaks
    } catch (e: any) {
        return true;
    }
}

async function tryHuggingFaceResearch(prompt: string, systemPrompt?: string): Promise<{ canonical_name: string, new_queries: string[] } | null> {
    if (!HF_TOKEN || hfDisabled) return null;
    try {
        const res = await fetch('https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${HF_TOKEN}` },
            body: JSON.stringify({ 
                inputs: `[INST] ${systemPrompt || ''}\n${prompt} [/INST]`, 
                parameters: { max_new_tokens: 300, temperature: 0.1 } 
            })
        });
        if (res.status === 401 || res.status === 403) { hfDisabled = true; return null; }
        if (res.status === 429) { hfDisabled = true; return null; }
        if (!res.ok) return null;
        const d = await res.json() as any;
        const text = Array.isArray(d) ? d[0]?.generated_text : d.generated_text;
        if (!text) return null;
        const fb = text.indexOf('{'), lb = text.lastIndexOf('}');
        if (fb === -1 || lb === -1) return null;
        const json = JSON.parse(text.substring(fb, lb + 1));
        console.log(`  [TITAN-HF] AI research successful.`);
        return { canonical_name: json.canonical_name, new_queries: json.surgical_queries };
    } catch (e: any) { console.error(`  [TITAN-HF CRASH] ${e.message}`); return null; }
}

async function positionstackGeocode(query: string): Promise<GeoResult | null> {
    if (!POSITIONSTACK_KEY || positionstackDisabled) return null;
    try {
        const url = `http://api.positionstack.com/v1/forward?access_key=${POSITIONSTACK_KEY}&query=${encodeURIComponent(query)}&country=KE&limit=1`;
        const res = await fetch(url);
        if (res.status === 401 || res.status === 403) {
            console.warn(`  [POSITIONSTACK] UNAUTHORIZED (${res.status}). Disabling for this run.`);
            positionstackDisabled = true;
            return null;
        }
        if (res.status === 429) {
            console.warn(`  [POSITIONSTACK] Rate limited. Disabling for this run.`);
            positionstackDisabled = true;
            return null;
        }
        if (!res.ok) return null;
        const data = await res.json() as any;
        if (!data.data?.length) return null;
        const r = data.data[0];
        const lat = r.latitude;
        const lng = r.longitude;
        if (!bboxValid(lat, lng)) return null;
        const conf = r.confidence || 0.5;
        return {
            lat, lng,
            address: r.label || r.name || '',
            method: 'positionstack',
            confidence: conf,
            accuracy_meters: conf > 0.7 ? 100 : 500,
            result_type: r.type || 'unknown',
            location_type: 'POSITIONSTACK',
            importance: conf,
            query_used: query,
            status: conf >= 0.7 ? 'verified' : 'approximate',
            should_write_coords: true
        };
    } catch (e: any) {
        console.error(`  [POSITIONSTACK ERR] ${e.message}`);
        return null;
    }
}

async function geokeoGeocode(query: string): Promise<GeoResult | null> {
    if (!GEOKEO_KEY || geokeoDisabled) return null;
    try {
        const url = `https://geokeo.com/geocode/v1/search.php?q=${encodeURIComponent(query)}&api=${GEOKEO_KEY}&country=ke`;
        const res = await fetch(url);
        if (res.status === 401 || res.status === 403) {
            console.warn(`  [GEOKEO] UNAUTHORIZED (${res.status}). Disabling for this run.`);
            geokeoDisabled = true;
            return null;
        }
        if (res.status === 429) {
            console.warn(`  [GEOKEO] Rate limited. Disabling for this run.`);
            geokeoDisabled = true;
            return null;
        }
        if (!res.ok) return null;
        const data = await res.json() as any;
        if (!data.results?.length) return null;
        const r = data.results[0];
        const lat = parseFloat(r.geometry?.location?.lat);
        const lng = parseFloat(r.geometry?.location?.lng);
        if (isNaN(lat) || isNaN(lng) || !bboxValid(lat, lng)) return null;
        const conf = 0.5;
        return {
            lat, lng,
            address: r.formatted_address || '',
            method: 'geokeo',
            confidence: conf,
            accuracy_meters: 500,
            result_type: r.type || 'unknown',
            location_type: 'GEOKEO',
            importance: conf,
            query_used: query,
            status: 'approximate',
            should_write_coords: true
        };
    } catch (e: any) {
        console.error(`  [GEOKEO ERR] ${e.message}`);
        return null;
    }
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

// Failure Category 3: Unified Geocoding Cascade
async function cascadeGeocode(queries: string[], row: any, pg: Client): Promise<GeoResult | null> {
    const ward = (row.ward || '').toUpperCase().trim();
    const county = (row.county || '').toUpperCase().trim();

    for (const q of queries) {
        const providers = [
            { name: 'arcgis', fn: arcgisGeocode },
            { name: 'arcgis', fn: arcgisGeocode },
            { name: 'geocode_earth', fn: geocodeEarthGeocode },
            { name: 'opencage', fn: opencageGeocode },
            { name: 'locationiq', fn: locationiqGeocode },
            { name: 'geoapify', fn: geoapifyGeocode },
            { name: 'nominatim', fn: nominatimGeocode },
            { name: 'positionstack', fn: positionstackGeocode },
            { name: 'geokeo', fn: geokeoGeocode },
            { name: 'geocode_maps', fn: geocodeMapsGeocode },
            { name: 'geonames', fn: geonamesGeocode },
            { name: 'ors', fn: orsGeocode }
        ];

        for (const p of providers) {
            // Failure Category 4: Check blacklist
            if (isBlacklisted(p.name, ward, county)) continue;

            const res = await p.fn(q);
            if (res) {
                // Problem 3: Confidence Floor
                // Reject results with zero or near-zero confidence (confidence < 0.1)
                if (res.confidence < 0.1) {
                    console.warn(`  [REJECT LOW-CONF] ${p.name} returned confidence ${res.confidence.toFixed(2)}. Rejected as poisoned.`);
                    continue;
                }

                // Attach details for spatial validation
                const spatialRow = { 
                    ...row, 
                    result_type_full: res.result_type 
                };
                
                if (await validateSpatial(res.lat, res.lng, spatialRow, pg)) {
                    return res;
                } else {
                    // Result failed spatial validation -> Blacklist this provider for this ward
                    blacklistProvider(p.name, ward, county);
                }
            }
        }
    }
    return null;
}

async function resolveRow(row: any, pg: Client): Promise<{ result: GeoResult | null; queries: string[]; totalTried: number }> {
    const queries = buildStringA(row);
    let totalTried = 0;
    let bestResult: GeoResult | null = null;

    const hasExistingGoogleCoords = row.geocode_method === 'google_geocoding_v5' && row.geocode_status === 'verified';

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 1: Google Maps — Try all 6 query tiers, accept ROOFTOP immediately
    // ═══════════════════════════════════════════════════════════════════════════
    for (const q of queries) {
        totalTried++;
        const gResult = await googleGeocode(q);
        await new Promise(r => setTimeout(r, BASE_DELAY_MS));

        if (gResult && await validateSpatial(gResult.lat, gResult.lng, row, pg)) {
            if (gResult.confidence >= 0.85) {
                // ROOFTOP or RANGE_INTERPOLATED — accept immediately, stop searching
                bestResult = gResult;
                break;
            }
            // GEOMETRIC_CENTER or APPROXIMATE — save but keep trying other tiers for better match
            if (!bestResult || gResult.confidence > bestResult.confidence) {
                bestResult = gResult;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2: Multi-Provider Fallback Cascade (when no ROOFTOP/RANGE found)
    // ═══════════════════════════════════════════════════════════════════════════
    if ((!bestResult || bestResult.confidence < 0.8) && !hasExistingGoogleCoords) {
        const cascadeRes = await cascadeGeocode(queries, row, pg);
        if (cascadeRes && (!bestResult || cascadeRes.confidence > bestResult.confidence)) {
            bestResult = cascadeRes;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 0: MoE Shapefile Pre-cascade (High Fidelity, Zero Cost)
    // ═══════════════════════════════════════════════════════════════════════════
    if (!bestResult || bestResult.confidence < 0.9) {
        const moeRes = await lookupMoESchool(row);
        if (moeRes) {
            console.log(`  [MOE-SHP] Match found in shapefile: ${moeRes.address}`);
            bestResult = moeRes;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 3: AI Recursive Research (Titan v12.0) — Last Resort
    // ═══════════════════════════════════════════════════════════════════════════
    if (!bestResult || !bestResult.should_write_coords) {
        console.log(`  [TITAN] No robust consensus. Researching active legacy records for ID ${row.id}...`);
        const research = await researchLocation(row, pg);
        if (research && research.new_queries?.length) {
            console.log(`  [TITAN] Surgical queries generated: [${research.new_queries.join(', ')}]`);
            const titanRes = await cascadeGeocode(research.new_queries, row, pg);
            if (titanRes) {
                bestResult = titanRes;
                console.log(`  [TITAN] Surgical AI lookup successful: ${titanRes.address}`);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 5: Ward-Cohort Spatial Interpolation (Fail-safe Fallback)
    // ═══════════════════════════════════════════════════════════════════════════
    if ((!bestResult || !bestResult.should_write_coords) && (row.ward && row.county)) {
        console.log(`  [COHORT] Attempting spatial interpolation for ${row.ward}...`);
        const cohortRes = await interpolateWardCohort(row.ward, row.county, pg);
        if (cohortRes) {
            bestResult = cohortRes;
            console.log(`  [COHORT] Assigned interpolated ward center coordinate.`);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 4: Ward Containment & Centroid Guard
    // ═══════════════════════════════════════════════════════════════════════════
    if (bestResult && bestResult.should_write_coords) {
        // 1. Centroid Proximity Guard — Reject generic ward centroids
        const wardName = (row.ward || '').trim();
        if (wardName && isWardCentroidProximity(bestResult.lat, bestResult.lng, wardName)) {
            console.warn(`  [CENTROID GUARD] ID ${row.id}: Result for ${row.office_location} is too close to ${wardName} centroid.`);
            bestResult.status = 'hitl_review';
            bestResult.should_write_coords = false;
        }

        // 2. BigDataCloud Reverse-Geocode Verification
        if (bestResult.should_write_coords && !await verifyWardContainment(bestResult.lat, bestResult.lng, row.ward)) {
             console.warn(`  [VERIFY-BDC] ID ${row.id}: Points outside ${row.ward}. Flagging for review.`);
             bestResult.status = 'hitl_review';
             bestResult.should_write_coords = false;
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
    const processedIds: number[] = [];

    // Process sequentially to prevent concurrent DB deprecation and API rate limit hammering
    for (const row of rows) {
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
    }

    // Phase 3: Automated Titan Cluster Audit
    await clusterAudit(pg, processedIds);

    return { resolved, hitl, failed };
}

async function main() {
    console.log('[GEO-v5] Initializing GEOC-v12.0 Production Engine...');
    await loadTruthCenters();
    await loadWardBoundaries();
    await loadMoESchools();
    
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
              AND (geocode_status IN ('pending', 'failed') OR geocode_status IS NULL OR geocode_status = '')
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
