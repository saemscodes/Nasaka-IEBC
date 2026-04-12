export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (degrees) => degrees * (Math.PI / 180);

export const findNearestOffice = (userLat, userLon, offices) => {
  if (!userLat || !userLon || !offices.length) return null;

  return offices
    .filter(office => office.latitude && office.longitude)
    .map(office => ({
      ...office,
      distance: calculateDistance(userLat, userLon, office.latitude, office.longitude)
    }))
    .sort((a, b) => a.distance - b.distance)[0] || null;
};

export const findNearestOffices = (userLat, userLon, offices, limit = 10) => {
  if (!userLat || !userLon || !offices.length) return [];

  return offices
    .filter(office => office.latitude && office.longitude)
    .map(office => ({
      ...office,
      distance: calculateDistance(userLat, userLon, office.latitude, office.longitude)
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
};

export const estimateTravelTime = (distanceKm) => {
  const walkingSpeed = 5; // km/h
  const drivingSpeed = 40; // km/h (urban average)

  const walkingMinutes = Math.ceil((distanceKm / walkingSpeed) * 60);
  const drivingMinutes = Math.ceil((distanceKm / drivingSpeed) * 60);

  return {
    walking: walkingMinutes,
    driving: drivingMinutes,
    walkingFormatted: walkingMinutes < 60
      ? `${walkingMinutes} min walk`
      : `${Math.floor(walkingMinutes / 60)}h ${walkingMinutes % 60}m walk`,
    drivingFormatted: drivingMinutes < 60
      ? `${drivingMinutes} min drive`
      : `${Math.floor(drivingMinutes / 60)}h ${drivingMinutes % 60}m drive`
  };
};

export const formatDistance = (distanceKm) => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
};

export const isValidCoordinate = (lat, lng) => {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

/**
 * toDecimalDegrees
 * Detects if a coordinate is likely in Web Mercator (meters) and converts to WGS84 (degrees).
 * Kenya bounds: Lat [-5, 5], Lng [33, 42].
 * Web Mercator bounds for Kenya: Y [-550000, 550000], X [3600000, 4700000].
 */
export const toDecimalDegrees = (val, isLatitude = true) => {
  if (typeof val !== 'number' || isNaN(val)) return val;

  // If value is within normal degree ranges, return as is
  if (isLatitude && val >= -90 && val <= 90) return val;
  if (!isLatitude && val >= -180 && val <= 180) return val;

  // Potential Web Mercator (EPSG:3857) detected
  const R = 6378137.0; // Earth radius in meters
  if (isLatitude) {
    // Y to Lat: (2 * atan(exp(y / R)) - PI/2) * 180 / PI
    const converted = (2 * Math.atan(Math.exp(val / R)) - Math.PI / 2) * (180 / Math.PI);
    return Math.max(-90, Math.min(90, converted));
  } else {
    // X to Lng: (x / R) * 180 / PI
    const converted = (val / R) * (180 / Math.PI);
    return Math.max(-180, Math.min(180, converted));
  }
};

/**
 * safeLatLng
 * Validates and auto-corrects coordinates for Kenya.
 * Detects swapped lat/lng (e.g., lat=34.7, lng=0.59 when it should be lat=0.59, lng=34.7).
 * Returns [lat, lng] tuple guaranteed to be in valid WGS84 range.
 */
export const safeLatLng = (lat, lng) => {
  let sLat = toDecimalDegrees(lat, true);
  let sLng = toDecimalDegrees(lng, false);

  // Detect swapped coordinates for Kenya:
  // Kenya lat range: [-5, 5], Kenya lng range: [33, 42]
  // If lat looks like a Kenya lng and lng looks like a Kenya lat, they're swapped
  if (sLat > 10 && sLng >= -6 && sLng <= 6 && sLat >= 30 && sLat <= 45) {
    const temp = sLat;
    sLat = sLng;
    sLng = temp;
  }

  // Final safety clamp to valid WGS84
  sLat = Math.max(-90, Math.min(90, sLat));
  sLng = Math.max(-180, Math.min(180, sLng));

  return [sLat, sLng];
};

/**
 * isValidKenyaCoordinate
 * Checks if the coordinate is within Kenya's approximate bounding box.
 */
export const isValidKenyaCoordinate = (lat, lng) => {
  const [sLat, sLng] = safeLatLng(lat, lng);
  return sLat >= -5.2 && sLat <= 5.5 && sLng >= 33.5 && sLng <= 42.5;
};

export const getBoundingBox = (lat, lng, radiusKm = 10) => {
  const sLat = toDecimalDegrees(lat, true);
  const sLng = toDecimalDegrees(lng, false);
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos(toRad(sLat)));

  return {
    north: sLat + latDelta,
    south: sLat - latDelta,
    east: sLng + lngDelta,
    west: sLng - lngDelta
  };
};
