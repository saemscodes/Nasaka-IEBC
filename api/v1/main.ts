export const config = { runtime: 'nodejs' };

import { validateApiKey, errorResponse, corsHeaders, logApiUsage, deductCredits, calculateRequestWeight } from '../../src/api-lib/api-auth';
import { createLogger } from '../../src/api-lib/logger';

const getEnv = (name: string, env?: any) => {
    const val = env?.[name] || env?.[`VITE_${name}`];
    if (val) return val;
    try {
        if (typeof process !== 'undefined' && process.env) {
            return process.env[name] || process.env[`VITE_${name}`];
        }
    } catch { }
    return undefined;
};

// Canonical 47 Kenyan counties — normalize variants
const COUNTY_NORMALIZE: Record<string, string> = {
    'MOMBASA': 'MOMBASA', 'KWALE': 'KWALE', 'KILIFI': 'KILIFI',
    'TANA RIVER': 'TANA RIVER', 'TANARIVER': 'TANA RIVER', 'TANA-RIVER': 'TANA RIVER',
    'LAMU': 'LAMU', 'TAITA TAVETA': 'TAITA TAVETA', 'TAITA-TAVETA': 'TAITA TAVETA', 'TAITA/TAVETA': 'TAITA TAVETA',
    'GARISSA': 'GARISSA', 'WAJIR': 'WAJIR', 'MANDERA': 'MANDERA',
    'MARSABIT': 'MARSABIT', 'ISIOLO': 'ISIOLO', 'MERU': 'MERU',
    'THARAKA NITHI': 'THARAKA-NITHI', 'THARAKA-NITHI': 'THARAKA-NITHI', 'THARAKA NITHI ': 'THARAKA-NITHI',
    'THARAKA - NITHI': 'THARAKA-NITHI', 'THARAKA / NITHI': 'THARAKA-NITHI',
    'EMBU': 'EMBU', 'KITUI': 'KITUI', 'MACHAKOS': 'MACHAKOS', 'MAKUENI': 'MAKUENI',
    'NYANDARUA': 'NYANDARUA', 'NYERI': 'NYERI', 'KIRINYAGA': 'KIRINYAGA',
    'MURANG\'A': 'MURANG\'A', 'MURANGA': 'MURANG\'A', 'MURANG A': 'MURANG\'A',
    'KIAMBU': 'KIAMBU', 'TURKANA': 'TURKANA',
    'WEST POKOT': 'WEST POKOT', 'WESTPOKOT': 'WEST POKOT', 'WEST-POKOT': 'WEST POKOT',
    'SAMBURU': 'SAMBURU',
    'TRANS NZOIA': 'TRANS-NZOIA', 'TRANS-NZOIA': 'TRANS-NZOIA', 'TRANSNZOIA': 'TRANS-NZOIA',
    'UASIN GISHU': 'UASIN GISHU', 'UASINGISHU': 'UASIN GISHU', 'UASIN-GISHU': 'UASIN GISHU',
    'ELGEYO MARAKWET': 'ELGEYO-MARAKWET', 'ELGEYO-MARAKWET': 'ELGEYO-MARAKWET', 'ELGEYO/MARAKWET': 'ELGEYO-MARAKWET', 'KEIYO-MARAKWET': 'ELGEYO-MARAKWET',
    'ELEGEYO-MARAKWET': 'ELGEYO-MARAKWET',
    'NANDI': 'NANDI', 'BARINGO': 'BARINGO', 'LAIKIPIA': 'LAIKIPIA', 'NAKURU': 'NAKURU',
    'NAROK': 'NAROK', 'KAJIADO': 'KAJIADO', 'KERICHO': 'KERICHO', 'BOMET': 'BOMET',
    'KAKAMEGA': 'KAKAMEGA', 'VIHIGA': 'VIHIGA', 'BUNGOMA': 'BUNGOMA', 'BUSIA': 'BUSIA',
    'SIAYA': 'SIAYA', 'KISUMU': 'KISUMU',
    'HOMA BAY': 'HOMA BAY', 'HOMABAY': 'HOMA BAY', 'HOMA-BAY': 'HOMA BAY',
    'MIGORI': 'MIGORI', 'KISII': 'KISII', 'NYAMIRA': 'NYAMIRA',
    'NAIROBI': 'NAIROBI', 'NAIROBI CITY': 'NAIROBI'
};

function normalizeCounty(c: string | null): string | null {
    if (!c) return null;
    const upper = c.trim().toUpperCase();
    return COUNTY_NORMALIZE[upper] || upper;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export default async function handler(req: Request, env?: any): Promise<Response> {
    const logger = createLogger(req);
    const startTime = Date.now();
    const headers = corsHeaders();

    if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });

    const url = new URL(req.url);
    const route = url.searchParams.get('route');

    if (!route) return errorResponse('Missing route parameter', 400);

    const SUPABASE_URL = getEnv('VITE_SUPABASE_URL', env) || getEnv('SUPABASE_URL', env);
    const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY', env);
    const SUPABASE_ANON = getEnv('VITE_SUPABASE_ANON_KEY', env) || getEnv('SUPABASE_ANON_KEY', env);

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return errorResponse('Server misconfiguration', 500);
    }

    try {
        // --- Phase 1: Authentication & Tiering (Strict Mode) ---
        const isHealth = route === 'health';
        const auth = await validateApiKey(req, { required: !isHealth, env });
        if (!auth.valid) {
             return errorResponse(auth.error, auth.status || 401, { retryAfter: auth.retryAfter });
        }

        // --- Phase 2: Route Dispatching ---
        switch (route) {
            case 'stats':
                return handleStats(req, SUPABASE_URL, SUPABASE_KEY, logger, startTime, auth, env);

            case 'counties':
                return handleCounties(req, SUPABASE_URL, SUPABASE_KEY, logger, startTime, auth, env);

            case 'status':
                return handleStatus(req, SUPABASE_URL, SUPABASE_ANON, startTime, auth, env);

            case 'locate':
                return handleLocate(req, SUPABASE_URL, SUPABASE_KEY, logger, startTime, auth, env);

            case 'boundary':
                return handleBoundary(req, SUPABASE_URL, SUPABASE_ANON, startTime, auth, env);

            case 'coordinates':
                return handleCoordinates(req, SUPABASE_URL, SUPABASE_ANON, startTime, auth, env);

            case 'offices':
                const id = url.searchParams.get('id');
                if (id) return handleOfficeById(req, SUPABASE_URL, SUPABASE_KEY, id, startTime, auth, env);
                return handleOffices(req, SUPABASE_URL, SUPABASE_KEY, logger, startTime, auth, env);

            case 'ai-proxy':
                return handleAIProxy(req, env, startTime, auth);

            default:
                return errorResponse('Invalid route', 404);
        }
    } catch (err: any) {
        logger.error(500, err.message);
        return errorResponse(err.message, 500);
    }
}

// ---- ROUTE HANDLERS ----

export async function handleHealth(baseUrl: string) {
    return Response.json({
        status: "operational",
        services: { database_connectivity: baseUrl ? "configured" : "missing" },
        version: "1.3.0",
        timestamp: new Date().toISOString()
    }, { headers: { ...corsHeaders(), 'Cache-Control': 'no-store' } });
}

export async function handleStats(req: Request, baseUrl: string, key: string, logger: any, startTime: number, auth: any, env: any) {
    const resp = await fetch(`${baseUrl}/rest/v1/rpc/get_api_stats`, {
        method: 'POST',
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }
    });
    
    let result: any;
    if (!resp.ok) {
        const fallback = await fetch(`${baseUrl}/rest/v1/iebc_offices?select=id,verified,latitude`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        const offices: any[] = await fallback.json();
        result = {
            total_stations: offices.length,
            verified_count: offices.filter(o => o.verified).length,
            coordinate_coverage: offices.filter(o => o.latitude !== null).length,
            counties_covered: 47,
            snapshot_timestamp: new Date().toISOString()
        };
    } else {
        result = await resp.json();
    }

    logApiUsage(auth.keyId, auth.tier, '/api/v1/stats', req.method, 200, startTime, req, env);
    return Response.json({ data: result }, { headers: { ...corsHeaders(), 'Cache-Control': 's-maxage=3600' } });
}

export async function handleCounties(req: Request, baseUrl: string, key: string, logger: any, startTime: number, auth: any, env: any) {
    const resp = await fetch(`${baseUrl}/rest/v1/counties?select=*&order=county_name.asc`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    
    if (!resp.ok) return Response.json({ data: [{ id: 1, county_name: 'MOMBASA' }], meta: { warning: 'Live data unavailable' } }, { headers: corsHeaders() });
    
    const data = await resp.json();
    logApiUsage(auth.keyId, auth.tier, '/api/v1/counties', req.method, 200, startTime, req, env);
    return Response.json({ data }, { headers: { ...corsHeaders(), 'Cache-Control': 's-maxage=86400' } });
}

export async function handleStatus(req: Request, baseUrl: string, key: string, startTime: number, auth: any, env: any) {
    const url = new URL(req.url);
    const county = url.searchParams.get('county');
    let qUrl = `${baseUrl}/rest/v1/iebc_offices?select=id,constituency,county,office_location,formatted_address,verified,geocode_status,latitude,longitude&order=county.asc`;
    if (county) qUrl += `&county=ilike.*${encodeURIComponent(county)}*`;
    const resp = await fetch(qUrl, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } });
    const offices: any[] = await resp.json();
    const enriched = offices.map(o => ({
        ...o,
        operational_status: o.verified ? 'verified' : 'pending',
        registration_open: !!o.verified
    }));
    
    logApiUsage(auth.keyId, auth.tier, '/api/v1/status', 'GET', 200, startTime, req, env);
    return Response.json({ data: enriched, total: enriched.length }, { headers: corsHeaders() });
}

export async function handleCoordinates(req: Request, baseUrl: string, key: string, startTime: number, auth: any, env: any) {
    const url = new URL(req.url);
    const county = url.searchParams.get('county');
    const table = url.searchParams.get('table') || 'iebc_offices';
    let select = 'id,constituency,county,latitude,longitude,verified';
    if (table === 'diaspora_registration_centres') select = 'id,mission_name,city,country,latitude,longitude';
    let qUrl = `${baseUrl}/rest/v1/${table}?select=${select}&latitude=not.is.null`;
    
    // Strict Mode: Filter forward
    if (county) {
        const normalized = normalizeCounty(county) || county;
        qUrl += `&county=ilike.*${encodeURIComponent(normalized)}*`;
    }
    
    const constituency = url.searchParams.get('constituency');
    if (constituency) qUrl += `&constituency=ilike.*${encodeURIComponent(constituency)}*`;
    
    const ward = url.searchParams.get('ward');
    if (ward) qUrl += `&ward=ilike.*${encodeURIComponent(ward)}*`;
    const resp = await fetch(qUrl, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } });
    const data = await resp.json();
    
    logApiUsage(auth.keyId, auth.tier, '/api/v1/coordinates', 'GET', 200, startTime, req, env);
    return Response.json({ data, total: data.length }, { headers: corsHeaders() });
}

export async function handleLocate(req: Request, baseUrl: string, key: string, logger: any, startTime: number, auth: any, env: any) {
    const url = new URL(req.url);
    const rawLat = parseFloat(url.searchParams.get('lat') || '');
    const rawLng = parseFloat(url.searchParams.get('lng') || '');

    // Server-side sanitization: Normalize Web Mercator to WGS84 if detected
    const lat = (rawLat > 90 || rawLat < -90)
        ? (2 * Math.atan(Math.exp(rawLat / 6378137.0)) - Math.PI / 2) * (180 / Math.PI)
        : rawLat;
    const lng = (rawLng > 180 || rawLng < -180)
        ? (rawLng / 6378137.0) * (180 / Math.PI)
        : rawLng;

    if (isNaN(lat) || isNaN(lng)) return errorResponse('Invalid coordinates', 400);

    let result: any = { data: [], layer: 'none' };

    // Protocol Layer A: Nearest Ward (RPC)
    const rpcResp = await fetch(`${baseUrl}/rest/v1/rpc/get_nearest_ward`, {
        method: 'POST',
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat_param: lat, lng_param: lng })
    });

    if (rpcResp.ok) {
        const wards = await rpcResp.json();
        if (wards && wards.length > 0) {
            const ward = wards[0];
            const officeResp = await fetch(`${baseUrl}/rest/v1/iebc_offices?ward=ilike.*${encodeURIComponent(ward.ward_name)}*&select=*&limit=5`, {
                headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
            });
            const offices = await officeResp.json();
            if (offices.length > 0) result = { data: offices, layer: 'ward', meta: { ward: ward.ward_name } };
        }
    }

    if (result.layer === 'none') {
        // Protocol Layer B: Constituency Context
        const constituencyResp = await fetch(`${baseUrl}/rest/v1/iebc_offices?select=*&order=latitude.asc&limit=50`, {
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        const allOffices: any[] = await constituencyResp.json();
        const nearestOffices = allOffices
            .filter(o => o.latitude && o.longitude)
            .map(o => ({ ...o, distance: haversineKm(lat, lng, o.latitude, o.longitude) }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 10);

        if (nearestOffices.length > 0 && nearestOffices[0].distance < 30) {
            result = { data: nearestOffices, layer: 'sub-county', meta: { nearest_distance: nearestOffices[0].distance } };
        } else if (nearestOffices.length > 0) {
            const county = nearestOffices[0].county;
            const countyResp = await fetch(`${baseUrl}/rest/v1/iebc_offices?county=eq.${encodeURIComponent(county)}&select=*&limit=10`, {
                headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
            });
            const countyOffices = await countyResp.json();
            result = { data: countyOffices, layer: 'county', meta: { county } };
        }
    }

    logApiUsage(auth.keyId, auth.tier, '/api/v1/locate', 'GET', 200, startTime, req, env);
    return Response.json(result, { headers: corsHeaders() });
}

export async function handleBoundary(req: Request, baseUrl: string, key: string, startTime: number, auth: any, env: any) {
    const url = new URL(req.url);
    const lat = parseFloat(url.searchParams.get('lat') || '');
    const lng = parseFloat(url.searchParams.get('lng') || '');
    const resp = await fetch(`${baseUrl}/rest/v1/constituencies?select=name,latitude,longitude,counties(name)&latitude=not.is.null`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const constituencies: any[] = await resp.json();
    let nearest = null; let minDist = Infinity;
    for (const c of constituencies) {
        const d = haversineKm(lat, lng, c.latitude, c.longitude);
        if (d < minDist) { minDist = d; nearest = c; }
    }
    
    logApiUsage(auth.keyId, auth.tier, '/api/v1/boundary', 'GET', 200, startTime, req, env);
    return Response.json({ data: { constituency: nearest?.name, county: nearest?.counties?.name } }, { headers: corsHeaders() });
}

export async function handleOffices(req: Request, baseUrl: string, key: string, logger: any, startTime: number, auth: any, env: any) {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || (auth.tier === 'public' ? '5' : '50')), 200);
    
    let qUrl = `${baseUrl}/rest/v1/iebc_offices?select=*&limit=${limit}`;
    
    // Strict Mode: Advanced Filtering forward
    const county = url.searchParams.get('county');
    if (county) qUrl += `&county=ilike.*${encodeURIComponent(county)}*`;
    
    const constituency = url.searchParams.get('constituency');
    if (constituency) qUrl += `&constituency=ilike.*${encodeURIComponent(constituency)}*`;
    
    const ward = url.searchParams.get('ward');
    if (ward) qUrl += `&ward=ilike.*${encodeURIComponent(ward)}*`;
    
    const landmark = url.searchParams.get('landmark');
    if (landmark) qUrl += `&landmark=ilike.*${encodeURIComponent(landmark)}*`;

    const resp = await fetch(qUrl, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    
    let data = await resp.json();
    
    // Tiered Access Boundary Enforcement
    if (auth.tier === 'public') {
        data = data.slice(0, 5);
    }

    logApiUsage(auth.keyId, auth.tier, '/api/v1/offices', 'GET', 200, startTime, req, env);
    
    return Response.json({ 
        data, 
        meta: { 
            tier: auth.tier, 
            weighted_cost: calculateRequestWeight(req, auth.tier),
            remaining_quota: auth.remaining 
        } 
    }, { headers: corsHeaders() });
}

export async function handleOfficeById(req: Request, baseUrl: string, key: string, id: string, startTime: number, auth: any, env: any) {
    const resp = await fetch(`${baseUrl}/rest/v1/iebc_offices?id=eq.${id}&select=*`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Prefer': 'plurality=singular' }
    });
    
    logApiUsage(auth.keyId, auth.tier, `/api/v1/offices/${id}`, 'GET', 200, startTime, req, env);
    return Response.json({ data: await resp.json() }, { headers: corsHeaders() });
}

export async function handleAIProxy(req: Request, env: any, startTime: number, auth: any) {
    if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

    try {
        const { provider, body } = await req.json();

        let apiTarget = '';
        let apiKey = '';
        let finalBody = JSON.stringify(body);

        switch (provider) {
            case 'mistral':
                apiTarget = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';
                apiKey = `Bearer ${getEnv('VITE_HF_API_TOKEN', env) || getEnv('HF_TOKEN', env)}`;
                break;
            case 'groq':
                apiTarget = 'https://api.groq.com/openai/v1/chat/completions';
                apiKey = `Bearer ${getEnv('VITE_GROQ_API_KEY', env) || getEnv('GROQ_API_KEY', env)}`;
                break;
            case 'gemini':
                const geminiKey = getEnv('VITE_GEMINI_API_KEY', env) || getEnv('GEMINI_API_KEY', env);
                apiTarget = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
                apiKey = ''; // Gemini uses query param
                break;
            case 'gemini_ground':
                const geminiGroundKey = getEnv('VITE_GEMINI_API_KEY', env) || getEnv('GEMINI_API_KEY', env);
                apiTarget = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiGroundKey}`;
                apiKey = '';
                break;
            default:
                return errorResponse('Invalid AI provider', 400);
        }

        if (!apiTarget) return errorResponse('Provider mismatch', 400);

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = apiKey;

        const aiResp = await fetch(apiTarget, {
            method: 'POST',
            headers,
            body: finalBody
        });

        const data = await aiResp.json();
        logApiUsage(auth.keyId, auth.tier, '/api/v1/ai-proxy', 'POST', aiResp.status, startTime, req, env, 10); // Fixed weight for AI
        return Response.json(data, { status: aiResp.status, headers: corsHeaders() });
    } catch (err: any) {
        return errorResponse(err.message, 500);
    }
}
