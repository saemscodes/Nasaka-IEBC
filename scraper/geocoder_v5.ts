/**
 * geocoder_v5.ts — Nasaka Stratified Matrix Geocoder v7.1 [STRICT MODE]
 * 
 * THE ULTIMATE GEOPROCESSOR — GOHAM EDITION
 * 
 * Matrix: Tiers (Search Strings) x Classes (Provider Groups)
 * 
 * v7.1 Fixes Incorporated:
 *  1. Landmark-free Tier 1 for PREMIUM Class.
 *  2. v3 Overwrite Policy (ROOFTOP/RANGE only).
 *  3. BBox Sanity Gate (Kenya bounds).
 *  4. ArcGIS Auth Model (Token/API Key parameters).
 *  5. HITL Short-circuit (No cascade on Premium fail/low-conf).
 *  6. 500m Corroboration Threshold.
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: fs.existsSync('.env') ? '.env' : '../.env' });

const dbUrl = process.env.SUPABASE_DB_POOLED_URL;

const KEYS = {
    GOOGLE: process.env.GOOGLE_MAPS_API_KEY,
    ARCGIS_1: process.env.ARCGIS_API_KEY_PRIMARY,
    ARCGIS_2: process.env.ARCGIS_API_KEY_SECONDARY,
    OPENCAGE: process.env.OPENCAGE_API_KEY,
    LOCATIONIQ: process.env.LOCATIONIQ_API_KEY,
    GEOAPIFY: process.env.GEOAPIFY_API_KEY,
    EARTH: process.env.GEOCODE_EARTH_API_KEY,
    GEOKEO: process.env.GEOKEO_API_KEY,
    STACK: process.env.POSITIONSTACK_API_KEY,
    CLOUD: process.env.BIGDATACLOUD_API_KEY,
    MAPS: process.env.GEOCODE_MAPS_API_KEY,
    GEONAMES: process.env.GEONAMES_USERNAME,
    NOMINATIM: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org'
};

const BATCH_SIZE = 200;
const MAX_CONCURRENT = 15;
const INTER_BATCH_DELAY_MS = 1000;
const CORROBORATION_RADIUS_KM = 0.5; // 500m

// Kenya Bounding Box (v3 Strict)
const KE_LAT_MIN = -4.72, KE_LAT_MAX = 4.62;
const KE_LNG_MIN = 33.91, KE_LNG_MAX = 41.91;

if (!dbUrl) { console.error('[FATAL] SUPABASE_DB_POOLED_URL missing'); process.exit(1); }
const pool = new Pool({ connectionString: dbUrl, max: MAX_CONCURRENT + 5 });

class RateLimiter {
    private lastCall = 0;
    constructor(private ms: number) {}
    async wait() {
        const wait = this.ms - (Date.now() - this.lastCall);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        this.lastCall = Date.now();
    }
}

const LIMITERS: Record<string, RateLimiter> = {
    premium: new RateLimiter(500),
    reliable: new RateLimiter(1100),
    open: new RateLimiter(1200)
};

interface GeoResult {
    lat: number; lng: number; address: string; method: string;
    confidence: number; accuracy: string; query: string;
    category: 'PREMIUM' | 'RELIABLE' | 'OPEN';
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inKenya(lat: number, lng: number): boolean {
    return lat >= KE_LAT_MIN && lat <= KE_LAT_MAX && lng >= KE_LNG_MIN && lng <= KE_LNG_MAX;
}

async function sFetch(url: string, prov: string, cat: string): Promise<any> {
    try {
        await LIMITERS[cat.toLowerCase()]?.wait();
        const res = await fetch(url, { headers: { 'User-Agent': `NasakaMatrix/7.1 (${prov})` }, signal: AbortSignal.timeout(10000) });
        if (!res.ok) return null;
        return await res.json();
    } catch { return null; }
}

// ── SEARCH TIERS ──────────────────────────────────────────────────────────

const SEARCH_TIERS = [
    // Tier 1: Surgical (LANDMARK-FREE for Premium)
    (r: any, skipLdmk: boolean) => {
        if (skipLdmk) return `${r.office_location}, ${r.ward}, ${r.constituency}, ${r.county} County, Kenya`;
        return `${r.office_location} near ${r.landmark}, ${r.ward}, ${r.constituency}, ${r.county} County, Kenya`;
    },
    // Tier 2: Enriched (With Landmark)
    (r: any) => `${r.office_location} near ${r.landmark}, ${r.ward}, ${r.constituency}, ${r.county} County, Kenya`,
    // Tier 3: Broad
    (r: any) => `${r.office_location}, ${r.constituency}, Kenya`,
    // Tier 4: Minimal
    (r: any) => `${r.constituency} IEBC Registration Centre, Kenya`
];

// ── PROVIDERS ─────────────────────────────────────────────────────────────

async function gGeo(q: string): Promise<GeoResult | null> {
    const d = await sFetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${KEYS.GOOGLE}&region=ke`, 'google', 'premium');
    if (!d || d.status !== 'OK' || !d.results?.length) return null;
    const r = d.results[0];
    const {lat, lng} = r.geometry.location;
    if (!inKenya(lat, lng)) return null;
    return { lat, lng, address: r.formatted_address, method: 'google', confidence: 1.0, accuracy: r.geometry.location_type, query: q, category: 'PREMIUM' };
}

async function aGeo(q: string, sec = false): Promise<GeoResult | null> {
    const k = sec ? KEYS.ARCGIS_2 : KEYS.ARCGIS_1;
    if (!k) return null;
    const d = await sFetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?address=${encodeURIComponent(q)}&f=json&token=${k}&maxLocations=1&countryCode=KEN`, 'arcgis', 'premium');
    if (!d || !d.candidates?.length) return null;
    const c = d.candidates[0];
    if (!inKenya(c.location.y, c.location.x)) return null;
    return { lat: c.location.y, lng: c.location.x, address: c.address, method: 'arcgis', confidence: c.score/100, accuracy: 'point', query: q, category: 'PREMIUM' };
}

async function oGeo(q: string): Promise<GeoResult | null> {
    const d = await sFetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(q)}&key=${KEYS.OPENCAGE}&countrycode=ke&limit=1&no_annotations=1`, 'opencage', 'reliable');
    if (!d || !d.results?.length) return null;
    const r = d.results[0];
    if (!inKenya(r.geometry.lat, r.geometry.lng)) return null;
    return { lat: r.geometry.lat, lng: r.geometry.lng, address: r.formatted, method: 'opencage', confidence: r.confidence/10, accuracy: 'point', query: q, category: 'RELIABLE' };
}

async function fGeo(q: string): Promise<GeoResult | null> {
    const d = await sFetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&apiKey=${KEYS.GEOAPIFY}&filter=countrycode:ke&limit=1`, 'geoapify', 'reliable');
    if (!d || !d.features?.length) return null;
    const r = d.features[0];
    const {coordinates} = r.geometry;
    if (!inKenya(coordinates[1], coordinates[0])) return null;
    return { lat: coordinates[1], lng: coordinates[0], address: r.properties.formatted, method: 'geoapify', confidence: 0.8, accuracy: 'point', query: q, category: 'RELIABLE' };
}

async function nGeo(q: string): Promise<GeoResult | null> {
    const d = await sFetch(`${KEYS.NOMINATIM}/search?q=${encodeURIComponent(q)}&format=json&countrycodes=ke&limit=1`, 'nominatim', 'open');
    if (!d || !d.length) return null;
    const r = d[0];
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    if (!inKenya(lat, lng)) return null;
    return { lat, lng, address: r.display_name, method: 'nominatim', confidence: parseFloat(r.importance)||0.4, accuracy: r.type, query: q, category: 'OPEN' };
}

// ── STRATIFIED MATRIX RESOLVER ────────────────────────────────────────────

async function resolveMatrix(row: any): Promise<{ res: GeoResult | null; tried: number; status: string }> {
    let tried = 0;
    const corroborationPool: GeoResult[] = [];

    // --- CLASS 1: PREMIUM (Nested Tiers) ---
    for (const [tierIdx, tierFn] of SEARCH_TIERS.entries()) {
        tried++;
        // Tier 1 for Premium is Landmark-FREE
        const q = tierFn(row, tierIdx === 0);
        
        // 1. Google
        const gRes = await gGeo(q);
        if (gRes) {
            if (gRes.accuracy === 'ROOFTOP' || gRes.accuracy === 'RANGE_INTERPOLATED') return { res: gRes, tried, status: 'verified' };
            // HITL SHORT-CIRCUIT: Low confidence in Premium = STOP and Exit Cascade
            return { res: null, tried, status: 'hitl_review' };
        }

        // 2. ArcGIS
        const aRes = await aGeo(q);
        if (aRes && aRes.confidence > 0.95) return { res: aRes, tried, status: 'verified' };
        if (aRes) return { res: null, tried, status: 'hitl_review' };
    }

    // --- CLASS 2: RELIABLE (Corroborated) ---
    for (const tierFn of SEARCH_TIERS) {
        tried++;
        const q = tierFn(row, false);
        const oc = await oGeo(q); if (oc) corroborationPool.push(oc);
        const ga = await fGeo(q); if (ga) corroborationPool.push(ga);

        // Check for 500m consensus
        for (let i = 0; i < corroborationPool.length; i++) {
            for (let j = i + 1; j < corroborationPool.length; j++) {
                if (haversine(corroborationPool[i].lat, corroborationPool[i].lng, corroborationPool[j].lat, corroborationPool[j].lng) < CORROBORATION_RADIUS_KM) {
                    process.stdout.write(`  [CORROB 500m] ${corroborationPool[i].method} + ${corroborationPool[j].method}\n`);
                    return { res: corroborationPool[i], tried, status: 'verified' };
                }
            }
        }
    }

    // --- CLASS 3: OPEN ---
    for (const tierFn of SEARCH_TIERS) {
        tried++;
        const q = tierFn(row, false);
        const nom = await nGeo(q);
        if (nom && nom.confidence > 0.5) return { res: nom, tried, status: 'verified' };
    }

    return { res: null, tried, status: 'failed' };
}

// ── PERSISTENCE & OVERWRITE ───────────────────────────────────────────────

async function writeResult(id: number, r: GeoResult | null, tried: number, status: string): Promise<void> {
    // v3 Overwrite Policy: Check existing accuracy
    const { rows } = await pool.query(`SELECT geocode_confidence, geocode_method FROM public.iebc_offices WHERE id = $1`, [id]);
    const existing = rows[0];
    if (existing && (existing.geocode_method === 'google' || existing.geocode_method === 'arcgis') && existing.geocode_confidence >= 0.9) {
        // [STRICT] Protected "Gold" result - skip overwrite
        return;
    }

    if (r && status === 'verified') {
        await pool.query(`
            UPDATE public.iebc_offices SET
                latitude = $1, longitude = $2, formatted_address = $3, geocode_method = $4,
                geocode_confidence = $5, geocode_status = $6, total_queries_tried = $7,
                successful_geocode_query = $8, source = 'Nasaka Matrix v7.1',
                verified = true, updated_at = NOW()
            WHERE id = $9
        `, [r.lat, r.lng, r.address, r.method, r.confidence, status, tried, r.query, id]);
    } else {
        await pool.query(`UPDATE public.iebc_offices SET geocode_status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
    }
}

// ── MAIN EXECUTION ────────────────────────────────────────────────────────────

async function main() {
    console.log('\n✊🏽🇰🇪 [MATRIX v7.1] GOHAM PRODUCTION ENGINE INITIATED.\n');
    while (true) {
        const { rows } = await pool.query(`
            SELECT id, office_location, ward, constituency, county, landmark
            FROM public.iebc_offices 
            WHERE office_type = 'REGISTRATION_CENTRE' AND (geocode_status IN ('pending', 'failed') OR latitude IS NULL)
            AND county != 'DIASPORA' ORDER BY id LIMIT $1
        `, [BATCH_SIZE]);
        if (!rows.length) break;

        process.stdout.write(`[MATRIX] Processing batch of ${rows.length}...\n`);
        await Promise.all(rows.map(async (row) => {
            const { res, tried, status } = await resolveMatrix(row);
            await writeResult(row.id, res, tried, status);
            const mark = status === 'verified' ? '+' : status === 'hitl_review' ? '?' : 'x';
            const logName = row.office_location?.substring(0,30);
            const logMethod = res ? res.method : status;
            process.stdout.write(`  ${mark} [${row.id}] ${logName} -> ${logMethod}\n`);
        }));
        await new Promise(r => setTimeout(r, INTER_BATCH_DELAY_MS));
    }
    console.log('\n[MATRIX] 100% REGISTRY POPULATION COMPLETE.\n');
    await pool.end();
}

main().catch(err => { console.error('[GIGA FATAL]', err); process.exit(1); });
