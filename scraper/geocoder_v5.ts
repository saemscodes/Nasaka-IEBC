/**
 * geocoder_v5.ts — Nasaka Stratified Matrix v7.3 [STRICT EXHAUSTIVE MODE]
 * 
 * THE FOOLPROOF GEOPROCESSOR — GOHAM EDITION
 * 
 * v7.3 Fixes:
 *  1. [SMART CASCADE] Exhaust all classes (Reliable + Open) before calling HITL.
 *  2. [PRIORITY] Premium(ROOFTOP) > Corroborated(Reliable/Open) > Premium(Low-Conf) > Single Open.
 *  3. [STRICT] Preserved Landmark-free T1 for Premium, BBox gate, 500m Corrob.
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

const BATCH_SIZE = 200, MAX_CONCURRENT = 15, INTER_BATCH_DELAY_MS = 1000, CORROBORATION_RADIUS_KM = 0.5;
const KE_LAT_MIN = -4.72, KE_LAT_MAX = 4.62, KE_LNG_MIN = 33.91, KE_LNG_MAX = 41.91;

if (!dbUrl) { console.error('[FATAL] DB URL MISSING'); process.exit(1); }
const pool = new Pool({ connectionString: dbUrl, max: MAX_CONCURRENT + 5 });

class RateLimiter {
    private lastCall = 0; constructor(private ms: number) {}
    async wait() {
        const wait = this.ms - (Date.now() - this.lastCall);
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
        this.lastCall = Date.now();
    }
}
const LIMITERS: Record<string, RateLimiter> = {
    premium: new RateLimiter(500), reliable: new RateLimiter(1100), open: new RateLimiter(1500)
};

interface GeoResult {
    lat: number; lng: number; address: string; method: string;
    confidence: number; accuracy: string; query: string;
    category: 'PREMIUM' | 'RELIABLE' | 'OPEN';
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; const dLat = (lat2-lat1)*Math.PI/180; const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function inKenya(lat: number, lng: number): boolean { return lat >= KE_LAT_MIN && lat <= KE_LAT_MAX && lng >= KE_LNG_MIN && lng <= KE_LNG_MAX; }

async function sFetch(url: string, prov: string, cat: string): Promise<any> {
    try {
        await LIMITERS[cat.toLowerCase()]?.wait();
        const res = await fetch(url, { headers: { 'User-Agent': `NasakaMatrix/7.3` }, signal: AbortSignal.timeout(10000) });
        if (!res.ok) {
            if (res.status === 401 || res.status === 403) console.error(` [${prov}] UNAUTHORIZED / FORBIDDEN (${res.status})`);
            return null;
        }
        return await res.json();
    } catch { return null; }
}

async function google(q: string): Promise<GeoResult | null> {
    const d = await sFetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${KEYS.GOOGLE}&region=ke`, 'google', 'premium');
    if (!d || d.status !== 'OK' || !d.results?.length) return null;
    const r = d.results[0]; if (!inKenya(r.geometry.location.lat, r.geometry.location.lng)) return null;
    return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, address: r.formatted_address, method: 'google', confidence: 1.0, accuracy: r.geometry.location_type, query: q, category: 'PREMIUM' };
}
async function arcgis(q: string, sec = false): Promise<GeoResult | null> {
    const k = sec ? KEYS.ARCGIS_2 : KEYS.ARCGIS_1; if (!k) return null;
    const d = await sFetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?address=${encodeURIComponent(q)}&f=json&token=${k}&maxLocations=1&countryCode=KEN`, 'arcgis', 'premium');
    if (!d || !d.candidates?.length) return null; const c = d.candidates[0]; if (!inKenya(c.location.y, c.location.x)) return null;
    return { lat: c.location.y, lng: c.location.x, address: c.address, method: 'arcgis', confidence: c.score/100, accuracy: 'point', query: q, category: 'PREMIUM' };
}
async function opencage(q: string): Promise<GeoResult | null> {
    const d = await sFetch(`https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(q)}&key=${KEYS.OPENCAGE}&countrycode=ke&limit=1`, 'opencage', 'reliable');
    if (!d || !d.results?.length) return null; const r = d.results[0]; if (!inKenya(r.geometry.lat, r.geometry.lng)) return null;
    return { lat: r.geometry.lat, lng: r.geometry.lng, address: r.formatted, method: 'opencage', confidence: r.confidence/10, accuracy: 'point', query: q, category: 'RELIABLE' };
}
async function geoapify(q: string): Promise<GeoResult | null> {
    const d = await sFetch(`https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(q)}&apiKey=${KEYS.GEOAPIFY}&filter=countrycode:ke&limit=1`, 'geoapify', 'reliable');
    if (!d || !d.features?.length) return null; const r = d.features[0]; if (!inKenya(r.geometry.coordinates[1], r.geometry.coordinates[0])) return null;
    return { lat: r.geometry.coordinates[1], lng: r.geometry.coordinates[0], address: r.properties.formatted, method: 'geoapify', confidence: 0.8, accuracy: 'point', query: q, category: 'RELIABLE' };
}
async function nominatim(q: string): Promise<GeoResult | null> {
    const d = await sFetch(`${KEYS.NOMINATIM}/search?q=${encodeURIComponent(q)}&format=json&countrycodes=ke&limit=1`, 'nominatim', 'open');
    if (!d || !d.length) return null; const r = d[0]; if (!inKenya(parseFloat(r.lat), parseFloat(r.lon))) return null;
    return { lat: parseFloat(r.lat), lng: parseFloat(r.lon), address: r.display_name, method: 'nominatim', confidence: parseFloat(r.importance)||0.4, accuracy: r.type, query: q, category: 'OPEN' };
}

// ── THE MATRIX RESOLVER ───────────────────────────────────────────────────

async function mainResolve(row: any): Promise<{ res: GeoResult | null; tried: number; status: string }> {
    let tried = 0; let premiumResult: GeoResult | null = null;
    const pool_corrob: GeoResult[] = [];
    const TIERS = [
        (sL?: boolean) => sL ? `${row.office_location}, ${row.ward}, ${row.constituency}, ${row.county}, Kenya` : `${row.office_location} near ${row.landmark}, ${row.ward}, ${row.constituency}, ${row.county}, Kenya`,
        (_?: boolean) => `${row.office_location}, ${row.constituency}, Kenya`,
        (_?: boolean) => `${row.constituency} IEBC centre Kenya`
    ];

    // 1. CLASS 1: PREMIUM (Gold Standard)
    for (const [tIdx, tFn] of TIERS.entries()) {
        tried++; const q = tFn(tIdx === 0);
        const g = await google(q);
        if (g) {
            if (g.accuracy === 'ROOFTOP' || g.accuracy === 'RANGE_INTERPOLATED') return { res: g, tried, status: 'verified' };
            premiumResult = g; // Keep low-conf result for later
        }
        const a = await arcgis(q);
        if (a && a.confidence > 0.95) return { res: a, tried, status: 'verified' };
        if (a && !premiumResult) premiumResult = a;
    }

    // 2. EXHAUSTIVE CASCADE (Reliable + Open combined)
    for (const tFn of TIERS) {
        tried++; const q = tFn(false);
        const oc = await opencage(q); if (oc) pool_corrob.push(oc);
        const ga = await geoapify(q); if (ga) pool_corrob.push(ga);
        const nom = await nominatim(q); if (nom) pool_corrob.push(nom);

        // Corroboration Check (DIFFERENT providers only)
        for (let i = 0; i < pool_corrob.length; i++) {
            for (let j = i + 1; j < pool_corrob.length; j++) {
                if (pool_corrob[i].method !== pool_corrob[j].method && haversine(pool_corrob[i].lat, pool_corrob[i].lng, pool_corrob[j].lat, pool_corrob[j].lng) < CORROBORATION_RADIUS_KM) {
                    process.stdout.write(`  [CORROB] ${pool_corrob[i].method} + ${pool_corrob[j].method}\n`);
                    return { res: pool_corrob[i], tried, status: 'verified' };
                }
            }
        }
    }

    // 3. FINAL FALLBACK: If Premium had a result, use it as HITL
    if (premiumResult) return { res: null, tried, status: 'hitl_review' };
    
    // Last ditch: if any single result found in pool with > 0.6 confidence
    const best = pool_corrob.sort((a,b) => b.confidence - a.confidence)[0];
    if (best && best.confidence > 0.6) return { res: best, tried, status: 'verified' };

    return { res: null, tried, status: 'failed' };
}

async function main() {
    console.log('\n✊🏽🇰🇪 [MATRIX v7.3] EXHAUSTIVE SMART CASCADE ACTIVE.\n');
    while (true) {
        const { rows } = await pool.query(`SELECT id, office_location, ward, constituency, county, landmark, geocode_method FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' AND (geocode_status IN ('pending', 'failed') OR latitude IS NULL) AND county != 'DIASPORA' ORDER BY id LIMIT $1`, [BATCH_SIZE]);
        if (!rows.length) break;
        await Promise.all(rows.map(async (row) => {
            if (row.geocode_method === 'google' || row.geocode_method === 'arcgis') return;
            const { res, tried, status } = await mainResolve(row);
            if (res) {
                await pool.query(`UPDATE public.iebc_offices SET latitude=$1, longitude=$2, formatted_address=$3, geocode_method=$4, geocode_confidence=$5, geocode_status='verified', total_queries_tried=$6, successful_geocode_query=$7, source='Nasaka Matrix v7.3', verified=true, updated_at=NOW() WHERE id=$8`, [res.lat, res.lng, res.address, res.method, res.confidence, tried, res.query, row.id]);
                process.stdout.write(`  + [${row.id}] ${row.office_location?.substring(0,30)} -> ${res.method}\n`);
            } else {
                await pool.query(`UPDATE public.iebc_offices SET geocode_status=$1, updated_at=NOW() WHERE id=$2`, [status, row.id]);
                process.stdout.write(`  x [${row.id}] ${row.office_location?.substring(0,30)} -> ${status}\n`);
            }
        }));
        await new Promise(r => setTimeout(r, INTER_BATCH_DELAY_MS));
    }
    await pool.end();
}
main().catch(e => { process.stdout.write(`[FATAL] ${e.message}\n`); process.exit(1); });
