// src/workers/geoWorker.js
// Web Worker for offloading Haversine distance calculations off the main thread.
// Receives { type: 'FIND_NEAREST', userLocation, offices } and returns the nearest office.

const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

self.onmessage = function (e) {
    const { type, userLocation, offices } = e.data;

    if (type === 'FIND_NEAREST') {
        if (!userLocation || !offices || offices.length === 0) {
            self.postMessage({ type: 'NEAREST_RESULT', nearestOffice: null });
            return;
        }

        const userLat = userLocation.latitude;
        const userLng = userLocation.longitude;

        // Perf 6: Bounding-box pre-filter — only check offices within ±0.5 degrees
        let candidates = offices.filter(o =>
            o.latitude && o.longitude &&
            Math.abs(o.latitude - userLat) < 0.5 &&
            Math.abs(o.longitude - userLng) < 0.5
        );

        // Fallback to full list if no nearby candidates
        if (candidates.length === 0) {
            candidates = offices.filter(o => o.latitude && o.longitude);
        }

        let nearestOffice = null;
        let minDistance = Infinity;

        candidates.forEach(office => {
            const dist = getDistance(userLat, userLng, office.latitude, office.longitude);
            if (dist < minDistance) {
                minDistance = dist;
                nearestOffice = office;
            }
        });

        self.postMessage({
            type: 'NEAREST_RESULT',
            nearestOffice,
            distance: minDistance
        });
    }
};
