// src/lib/geocode.ts
// Nominatim geocoder — Kenya-scoped
// Forward geocode: place name → coordinates
// Reverse geocode: coordinates → place name

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

export interface GeocodedPlace {
    name: string;
    displayName: string;
    lat: number;
    lng: number;
    type: string;
    county?: string;
    boundingBox: [number, number, number, number]; // [south, north, west, east]
}

export async function geocodeKenyaPlace(query: string): Promise<GeocodedPlace[]> {
    const params = new URLSearchParams({
        q: query,
        format: 'json',
        countrycodes: 'ke',
        addressdetails: '1',
        extratags: '1',
        namedetails: '1',
        limit: '5',
        'accept-language': 'en,sw',
    });

    const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
        headers: {
            'User-Agent': 'NasakaIEBC/1.0 (nasakaiebc.civiceducationkenya.com)',
        },
    });

    if (!res.ok) throw new Error('Geocoding failed');

    const data = await res.json();

    return data.map((item: any) => ({
        name: item.namedetails?.name || item.display_name.split(',')[0],
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type,
        county: item.address?.state || item.address?.county,
        boundingBox: item.boundingbox.map(parseFloat) as [number, number, number, number],
    }));
}

export async function reverseGeocodeKenya(lat: number, lng: number): Promise<string> {
    const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lng),
        format: 'json',
        zoom: '14',
        'accept-language': 'en,sw',
    });

    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
        headers: { 'User-Agent': 'NasakaIEBC/1.0 (nasakaiebc.civiceducationkenya.com)' },
    });

    if (!res.ok) throw new Error('Reverse geocoding failed');

    const data = await res.json();
    const addr = data.address;

    const parts = [
        addr.suburb || addr.neighbourhood || addr.quarter,
        addr.town || addr.city || addr.village,
        addr.county,
    ].filter(Boolean);

    return parts.join(', ');
}
