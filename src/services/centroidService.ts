/**
 * src/services/centroidService.ts
 * Dedicated service to fetch and manage static centroid data for Wards and Constituencies.
 * These files are stored in Supabase 'map-data' bucket as secondary/static sources of truth.
 */

const CONSTITUENCIES_URL = 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/constituencies_with_centroids.geojson';
const WARDS_URL = 'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/kenya_wards_centroids.json';

interface Centroid {
    lat: number;
    lng: number;
}

interface WardData {
    name: string;
    constituency: string;
    county: string;
    lat: number;
    lng: number;
}

let wardCache: WardData[] | null = null;
let constituencyCache: any | null = null;

const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Fetches and returns ward centroid data.
 * Results are cached in memory.
 */
export const getWardCentroid = async (wardName: string, constituencyName?: string): Promise<Centroid | null> => {
    try {
        if (!wardCache) {
            const response = await fetch(WARDS_URL);
            if (!response.ok) throw new Error('Failed to fetch ward centroids');
            wardCache = await response.json();
        }

        if (!wardCache) return null;

        const targetWard = normalize(wardName);
        const targetConst = constituencyName ? normalize(constituencyName) : null;

        const match = wardCache.find(w => {
            const wNameMatch = normalize(w.name) === targetWard || targetWard.includes(normalize(w.name));
            if (!wNameMatch) return false;
            if (targetConst) {
                return normalize(w.constituency).includes(targetConst) || targetConst.includes(normalize(w.constituency));
            }
            return true;
        });

        if (match) {
            return { lat: match.lat, lng: match.lng };
        }
        return null;
    } catch (error) {
        console.error('[CentroidService] Error fetching ward centroid:', error);
        return null;
    }
};

/**
 * Fetches and returns constituency centroid data from GeoJSON.
 */
export const getConstituencyCentroid = async (constituencyName: string): Promise<Centroid | null> => {
    try {
        if (!constituencyCache) {
            const response = await fetch(CONSTITUENCIES_URL);
            if (!response.ok) throw new Error('Failed to fetch constituency centroids');
            constituencyCache = await response.json();
        }

        if (!constituencyCache || !constituencyCache.features) return null;

        const target = normalize(constituencyName);

        const feature = constituencyCache.features.find((f: any) => {
            const name = f.properties.constituency_name || f.properties.name || '';
            return normalize(name) === target || target.includes(normalize(name));
        });

        if (feature && feature.properties.latitude && feature.properties.longitude) {
            return {
                lat: Number(feature.properties.latitude),
                lng: Number(feature.properties.longitude)
            };
        }
        return null;
    } catch (error) {
        console.error('[CentroidService] Error fetching constituency centroid:', error);
        return null;
    }
};
