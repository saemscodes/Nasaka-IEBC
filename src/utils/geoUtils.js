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

export const getBoundingBox = (lat, lng, radiusKm = 10) => {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos(toRad(lat)));
  
  return {
    north: lat + latDelta,
    south: lat - latDelta,
    east: lng + lngDelta,
    west: lng - lngDelta
  };
};
