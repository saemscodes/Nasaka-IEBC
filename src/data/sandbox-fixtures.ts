// src/data/sandbox-fixtures.ts
// Nasaka IEBC Sandbox — Static fixture data for sandbox API testing
// All data is realistic Kenyan IEBC office data in production response format

export interface SandboxOffice {
    id: string;
    constituency: string;
    county: string;
    office_location: string;
    latitude: number;
    longitude: number;
    verified: boolean;
    formatted_address: string;
    landmark: string;
    geocode_status: string;
    confidence_score: number;
}

export interface SandboxCounty {
    county: string;
    office_count: number;
    verified_count: number;
    coverage_pct: number;
}

export interface SandboxLocateResult {
    id: string;
    constituency: string;
    county: string;
    office_location: string;
    latitude: number;
    longitude: number;
    distance_km: number;
    verified: boolean;
    formatted_address: string;
}

// ─── Health Fixture ──────────────────────────────────────────────────────────
export const SANDBOX_HEALTH = {
    status: 'operational',
    services: {
        api_gateway: 'ok',
        edge_runtime: 'ok',
        database_connectivity: 'configured',
        auth_layer: 'initialized',
    },
    version: '1.2.0-sandbox',
    timestamp: new Date().toISOString(),
    sandbox: true,
};

// ─── Offices Fixture ─────────────────────────────────────────────────────────
export const SANDBOX_OFFICES: SandboxOffice[] = [
    {
        id: 'sbx-001',
        constituency: 'WESTLANDS',
        county: 'NAIROBI',
        office_location: 'Westlands IEBC Office, Ring Road, Westlands',
        latitude: -1.2672,
        longitude: 36.8111,
        verified: true,
        formatted_address: 'Ring Road Westlands, Nairobi, Kenya',
        landmark: 'Near Sarit Centre',
        geocode_status: 'nasaka_verified',
        confidence_score: 0.97,
    },
    {
        id: 'sbx-002',
        constituency: 'LANGATA',
        county: 'NAIROBI',
        office_location: 'Langata IEBC Office, Langata Road',
        latitude: -1.3393,
        longitude: 36.7356,
        verified: true,
        formatted_address: 'Langata Road, Nairobi, Kenya',
        landmark: 'Near Galleria Mall',
        geocode_status: 'nasaka_verified',
        confidence_score: 0.95,
    },
    {
        id: 'sbx-003',
        constituency: 'DAGORETTI NORTH',
        county: 'NAIROBI',
        office_location: 'Dagoretti North IEBC Office, Waiyaki Way',
        latitude: -1.2691,
        longitude: 36.7488,
        verified: true,
        formatted_address: 'Waiyaki Way, Nairobi, Kenya',
        landmark: 'Near Uthiru Market',
        geocode_status: 'nasaka_verified',
        confidence_score: 0.93,
    },
    {
        id: 'sbx-004',
        constituency: 'STAREHE',
        county: 'NAIROBI',
        office_location: 'Anniversary Towers, University Way',
        latitude: -1.2838,
        longitude: 36.8157,
        verified: true,
        formatted_address: 'Anniversary Towers, University Way, Nairobi',
        landmark: 'IEBC Headquarters',
        geocode_status: 'nasaka_verified',
        confidence_score: 0.99,
    },
    {
        id: 'sbx-005',
        constituency: 'MVITA',
        county: 'MOMBASA',
        office_location: 'Mvita IEBC Office, Digo Road',
        latitude: -4.0434,
        longitude: 39.6682,
        verified: true,
        formatted_address: 'Digo Road, Mombasa, Kenya',
        landmark: 'Near Fort Jesus',
        geocode_status: 'nasaka_verified',
        confidence_score: 0.96,
    },
    {
        id: 'sbx-006',
        constituency: 'CHANGAMWE',
        county: 'MOMBASA',
        office_location: 'Changamwe IEBC Office, Jomo Kenyatta Avenue',
        latitude: -4.0216,
        longitude: 39.6314,
        verified: true,
        formatted_address: 'Jomo Kenyatta Avenue, Changamwe, Mombasa',
        landmark: 'Near Port Reitz',
        geocode_status: 'nasaka_verified',
        confidence_score: 0.92,
    },
    {
        id: 'sbx-007',
        constituency: 'KISUMU CENTRAL',
        county: 'KISUMU',
        office_location: 'Kisumu IEBC Office, Oginga Odinga Street',
        latitude: -0.0912,
        longitude: 34.7610,
        verified: true,
        formatted_address: 'Oginga Odinga Street, Kisumu, Kenya',
        landmark: 'Near Kisumu Bus Park',
        geocode_status: 'nasaka_verified',
        confidence_score: 0.94,
    },
    {
        id: 'sbx-008',
        constituency: 'ELDORET NORTH',
        county: 'UASIN GISHU',
        office_location: 'Eldoret IEBC Office, Uganda Road',
        latitude: 0.5143,
        longitude: 35.2698,
        verified: true,
        formatted_address: 'Uganda Road, Eldoret, Kenya',
        landmark: 'Near Zion Mall',
        geocode_status: 'nasaka_verified',
        confidence_score: 0.91,
    },
    {
        id: 'sbx-009',
        constituency: 'NAKURU TOWN EAST',
        county: 'NAKURU',
        office_location: 'Nakuru IEBC Office, Kenyatta Avenue',
        latitude: -0.3031,
        longitude: 36.0800,
        verified: true,
        formatted_address: 'Kenyatta Avenue, Nakuru, Kenya',
        landmark: 'Near Merica Hotel',
        geocode_status: 'nasaka_verified',
        confidence_score: 0.93,
    },
    {
        id: 'sbx-010',
        constituency: 'NYERI TOWN',
        county: 'NYERI',
        office_location: 'Nyeri IEBC Office, Kimathi Way',
        latitude: -0.4167,
        longitude: 36.9500,
        verified: false,
        formatted_address: 'Kimathi Way, Nyeri, Kenya',
        landmark: 'Near White Rhino Hotel',
        geocode_status: 'geocoded',
        confidence_score: 0.78,
    },
    {
        id: 'sbx-011',
        constituency: 'GARISSA TOWNSHIP',
        county: 'GARISSA',
        office_location: 'Garissa IEBC Office, Provincial Headquarters',
        latitude: -0.4536,
        longitude: 39.6461,
        verified: false,
        formatted_address: 'Provincial HQ, Garissa, Kenya',
        landmark: 'Near Garissa County Assembly',
        geocode_status: 'geocoded',
        confidence_score: 0.72,
    },
    {
        id: 'sbx-012',
        constituency: 'MACHAKOS TOWN',
        county: 'MACHAKOS',
        office_location: 'Machakos IEBC Office, Syokimau Road',
        latitude: -1.5177,
        longitude: 37.2634,
        verified: true,
        formatted_address: 'Syokimau Road, Machakos, Kenya',
        landmark: 'Near People\'s Park',
        geocode_status: 'nasaka_verified',
        confidence_score: 0.90,
    },
];

// ─── Counties Fixture ────────────────────────────────────────────────────────
export const SANDBOX_COUNTIES: SandboxCounty[] = [
    { county: 'NAIROBI', office_count: 17, verified_count: 15, coverage_pct: 88.2 },
    { county: 'MOMBASA', office_count: 6, verified_count: 5, coverage_pct: 83.3 },
    { county: 'KISUMU', office_count: 7, verified_count: 6, coverage_pct: 85.7 },
    { county: 'NAKURU', office_count: 11, verified_count: 9, coverage_pct: 81.8 },
    { county: 'UASIN GISHU', office_count: 6, verified_count: 5, coverage_pct: 83.3 },
    { county: 'KIAMBU', office_count: 12, verified_count: 10, coverage_pct: 83.3 },
    { county: 'MACHAKOS', office_count: 8, verified_count: 7, coverage_pct: 87.5 },
    { county: 'NYERI', office_count: 6, verified_count: 4, coverage_pct: 66.7 },
    { county: 'GARISSA', office_count: 6, verified_count: 3, coverage_pct: 50.0 },
    { county: 'KAJIADO', office_count: 5, verified_count: 4, coverage_pct: 80.0 },
    { county: 'KILIFI', office_count: 7, verified_count: 5, coverage_pct: 71.4 },
    { county: 'KAKAMEGA', office_count: 12, verified_count: 10, coverage_pct: 83.3 },
];

// ─── Locate Fixture (pre-built nearest-to-Nairobi results) ──────────────────
export const SANDBOX_LOCATE: SandboxLocateResult[] = [
    {
        id: 'sbx-004',
        constituency: 'STAREHE',
        county: 'NAIROBI',
        office_location: 'Anniversary Towers, University Way',
        latitude: -1.2838,
        longitude: 36.8157,
        distance_km: 0.0,
        verified: true,
        formatted_address: 'Anniversary Towers, University Way, Nairobi',
    },
    {
        id: 'sbx-001',
        constituency: 'WESTLANDS',
        county: 'NAIROBI',
        office_location: 'Westlands IEBC Office, Ring Road, Westlands',
        latitude: -1.2672,
        longitude: 36.8111,
        distance_km: 1.9,
        verified: true,
        formatted_address: 'Ring Road Westlands, Nairobi, Kenya',
    },
    {
        id: 'sbx-003',
        constituency: 'DAGORETTI NORTH',
        county: 'NAIROBI',
        office_location: 'Dagoretti North IEBC Office, Waiyaki Way',
        latitude: -1.2691,
        longitude: 36.7488,
        distance_km: 7.4,
        verified: true,
        formatted_address: 'Waiyaki Way, Nairobi, Kenya',
    },
    {
        id: 'sbx-002',
        constituency: 'LANGATA',
        county: 'NAIROBI',
        office_location: 'Langata IEBC Office, Langata Road',
        latitude: -1.3393,
        longitude: 36.7356,
        distance_km: 10.1,
        verified: true,
        formatted_address: 'Langata Road, Nairobi, Kenya',
    },
];

// ─── Stats Fixture ───────────────────────────────────────────────────────────
export const SANDBOX_STATS = {
    total_offices: 290,
    verified_offices: 247,
    counties_covered: 47,
    constituencies_covered: 290,
    verification_rate: 85.2,
    last_updated: '2026-03-15T00:00:00.000Z',
    sandbox: true,
};

// ─── Endpoint Router ─────────────────────────────────────────────────────────
export function getSandboxResponse(endpoint: string, params: URLSearchParams): { data: any; meta: any } {
    const ep = endpoint.replace(/^\/?(api\/v1\/)?/, '').toLowerCase();

    switch (ep) {
        case 'health': {
            return {
                data: { ...SANDBOX_HEALTH, timestamp: new Date().toISOString() },
                meta: { sandbox: true, endpoint: '/api/v1/health' },
            };
        }

        case 'offices': {
            let filtered = [...SANDBOX_OFFICES];
            const county = params.get('county');
            const constituency = params.get('constituency');
            const verified = params.get('verified');
            const limit = Math.min(parseInt(params.get('limit') || '50'), 200);
            const offset = parseInt(params.get('offset') || '0');

            if (county) {
                filtered = filtered.filter(o => o.county.toLowerCase().includes(county.toLowerCase()));
            }
            if (constituency) {
                filtered = filtered.filter(o => o.constituency.toLowerCase().includes(constituency.toLowerCase()));
            }
            if (verified === 'true') filtered = filtered.filter(o => o.verified);
            if (verified === 'false') filtered = filtered.filter(o => !o.verified);

            const total = filtered.length;
            const sliced = filtered.slice(offset, offset + limit);

            return {
                data: sliced,
                meta: {
                    sandbox: true,
                    endpoint: '/api/v1/offices',
                    pagination: { total, limit, offset, has_more: offset + limit < total },
                    tier: 'sandbox',
                    shaped: false,
                },
            };
        }

        case 'counties': {
            return {
                data: SANDBOX_COUNTIES,
                meta: { sandbox: true, endpoint: '/api/v1/counties', total: SANDBOX_COUNTIES.length },
            };
        }

        case 'locate': {
            const lat = parseFloat(params.get('lat') || '-1.2838');
            const lng = parseFloat(params.get('lng') || '36.8157');
            const radius = parseFloat(params.get('radius') || '10');

            // Simple haversine for sandbox
            const toRad = (d: number) => (d * Math.PI) / 180;
            const haversine = (la1: number, lo1: number, la2: number, lo2: number) => {
                const R = 6371;
                const dLat = toRad(la2 - la1);
                const dLon = toRad(lo2 - lo1);
                const a =
                    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            };

            const results = SANDBOX_OFFICES.map(o => ({
                id: o.id,
                constituency: o.constituency,
                county: o.county,
                office_location: o.office_location,
                latitude: o.latitude,
                longitude: o.longitude,
                distance_km: Math.round(haversine(lat, lng, o.latitude, o.longitude) * 10) / 10,
                verified: o.verified,
                formatted_address: o.formatted_address,
            }))
                .filter(o => o.distance_km <= radius)
                .sort((a, b) => a.distance_km - b.distance_km)
                .slice(0, 5);

            return {
                data: results,
                meta: {
                    sandbox: true,
                    endpoint: '/api/v1/locate',
                    query: { lat, lng, radius },
                    results_count: results.length,
                },
            };
        }

        case 'stats': {
            return {
                data: SANDBOX_STATS,
                meta: { sandbox: true, endpoint: '/api/v1/stats' },
            };
        }

        default: {
            return {
                data: null,
                meta: {
                    sandbox: true,
                    error: `Endpoint '${endpoint}' is not available in sandbox mode. Available: health, offices, counties, locate, stats`,
                },
            };
        }
    }
}
