// src/utils/tileUtils.ts
// Route-aware tile calculation for offline map downloads
// Uses geometric buffering around route corridors to identify required tiles

// ─── Tile Coordinate Conversion ─────────────────────────────────────────────

export interface TileCoord {
    x: number;
    y: number;
    z: number;
}

/**
 * Convert a longitude/latitude pair to tile X/Y at a given zoom level.
 * Standard Slippy Map / Web Mercator conversion.
 */
export function lonLatToTile(lon: number, lat: number, zoom: number): TileCoord {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lon + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    );
    return { x, y, z: zoom };
}

/**
 * Convert tile coordinates back to the NW corner longitude/latitude.
 */
export function tileToLonLat(x: number, y: number, z: number): [number, number] {
    const n = Math.pow(2, z);
    const lon = (x / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
    const lat = (latRad * 180) / Math.PI;
    return [lon, lat];
}

// ─── Bounding Box from Route Coordinates ────────────────────────────────────

interface BBox {
    minLon: number;
    minLat: number;
    maxLon: number;
    maxLat: number;
}

/**
 * Compute a bounding box around a set of [lon, lat] coordinates
 * with an optional buffer in kilometers.
 */
function computeBBox(
    coords: Array<[number, number]>,
    bufferKm: number = 0.5
): BBox {
    let minLon = Infinity, minLat = Infinity;
    let maxLon = -Infinity, maxLat = -Infinity;

    for (const [lon, lat] of coords) {
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    }

    // Convert buffer km to approximate degrees
    // 1 degree latitude ≈ 111 km
    // 1 degree longitude ≈ 111 * cos(lat) km
    const midLat = (minLat + maxLat) / 2;
    const latBuffer = bufferKm / 111;
    const lonBuffer = bufferKm / (111 * Math.cos((midLat * Math.PI) / 180));

    return {
        minLon: minLon - lonBuffer,
        minLat: minLat - latBuffer,
        maxLon: maxLon + lonBuffer,
        maxLat: maxLat + latBuffer
    };
}

// ─── Extract Coordinates from GeoJSON or LatLng Arrays ──────────────────────

/**
 * Extract [lon, lat] coordinate pairs from various route geometry formats.
 * Supports GeoJSON LineString, Leaflet LatLng arrays, and plain coordinate arrays.
 */
function extractCoordinates(routeGeometry: any): Array<[number, number]> {
    // GeoJSON LineString
    if (routeGeometry?.type === 'LineString' && Array.isArray(routeGeometry.coordinates)) {
        return routeGeometry.coordinates as Array<[number, number]>;
    }

    // GeoJSON Feature
    if (routeGeometry?.type === 'Feature' && routeGeometry.geometry) {
        return extractCoordinates(routeGeometry.geometry);
    }

    // Leaflet LatLng array (from leaflet-routing-machine)
    if (Array.isArray(routeGeometry)) {
        const first = routeGeometry[0];

        // [{lat, lng}] format
        if (first && typeof first === 'object' && 'lat' in first && 'lng' in first) {
            return routeGeometry.map((p: any) => [p.lng, p.lat] as [number, number]);
        }

        // [[lon, lat]] format
        if (Array.isArray(first) && first.length >= 2) {
            return routeGeometry as Array<[number, number]>;
        }
    }

    // GeoJSON Point (vicinity caching fallback)
    if (routeGeometry?.type === 'Point' && Array.isArray(routeGeometry.coordinates)) {
        return [routeGeometry.coordinates as [number, number]];
    }

    // Leaflet route coordinates (from routing control)
    if (routeGeometry?.coordinates) {
        return extractCoordinates(routeGeometry.coordinates);
    }

    console.warn('[tileUtils] Could not extract coordinates from route geometry');
    return [];
}

// ─── Get Tiles for a Route ──────────────────────────────────────────────────

export interface TileDownloadPlan {
    tiles: string[];
    tileCount: number;
    estimatedSizeMB: number;
    zoomLevels: number[];
    bufferKm: number;
}

/**
 * Compute all tile URLs needed to cover a route corridor at specified zoom levels.
 *
 * @param routeGeometry - GeoJSON LineString, Leaflet LatLng array, or coordinate array
 * @param zoomLevels - Array of zoom levels to cover (default: 14, 15, 16)
 * @param bufferKm - Buffer around route in km (default: 0.5 for minimal, 1.5 for extended)
 * @param tileUrlTemplate - URL template with {z}/{x}/{y} placeholders
 */
export function getTilesForRoute(
    routeGeometry: any,
    zoomLevels: number[] = [14, 15, 16],
    bufferKm: number = 0.5,
    tileUrlTemplate: string = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
): TileDownloadPlan {
    const coords = extractCoordinates(routeGeometry);

    if (coords.length === 0) {
        return { tiles: [], tileCount: 0, estimatedSizeMB: 0, zoomLevels, bufferKm };
    }

    const bbox = computeBBox(coords, bufferKm);
    const tileSet = new Set<string>();

    for (const z of zoomLevels) {
        const topLeft = lonLatToTile(bbox.minLon, bbox.maxLat, z);
        const bottomRight = lonLatToTile(bbox.maxLon, bbox.minLat, z);

        // Clamp to valid tile range
        const maxTileIdx = Math.pow(2, z) - 1;
        const xMin = Math.max(0, topLeft.x);
        const xMax = Math.min(maxTileIdx, bottomRight.x);
        const yMin = Math.max(0, topLeft.y);
        const yMax = Math.min(maxTileIdx, bottomRight.y);

        for (let x = xMin; x <= xMax; x++) {
            for (let y = yMin; y <= yMax; y++) {
                const url = tileUrlTemplate
                    .replace('{z}', z.toString())
                    .replace('{x}', x.toString())
                    .replace('{y}', y.toString());
                tileSet.add(url);
            }
        }
    }

    const tiles = Array.from(tileSet);
    // Average OSM tile ≈ 20-40KB; use 30KB as estimate
    const estimatedSizeMB = parseFloat(((tiles.length * 30) / 1024).toFixed(1));

    return {
        tiles,
        tileCount: tiles.length,
        estimatedSizeMB,
        zoomLevels,
        bufferKm
    };
}

// ─── Storage Helpers ────────────────────────────────────────────────────────

/**
 * Request persistent browser storage to prevent automatic eviction.
 */
export async function requestPersistentStorage(): Promise<boolean> {
    if (navigator.storage && navigator.storage.persist) {
        return navigator.storage.persist();
    }
    return false;
}

/**
 * Get current storage usage estimates.
 */
export async function getStorageEstimate(): Promise<{
    usedMB: number;
    quotaMB: number;
    percentUsed: number;
} | null> {
    if (!navigator.storage || !navigator.storage.estimate) return null;

    const estimate = await navigator.storage.estimate();
    const usedMB = parseFloat(((estimate.usage || 0) / (1024 * 1024)).toFixed(1));
    const quotaMB = parseFloat(((estimate.quota || 0) / (1024 * 1024)).toFixed(1));
    const percentUsed = quotaMB > 0 ? parseFloat(((usedMB / quotaMB) * 100).toFixed(1)) : 0;

    return { usedMB, quotaMB, percentUsed };
}
