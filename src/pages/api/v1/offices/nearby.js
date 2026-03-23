import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const lat = parseFloat(url.searchParams.get('lat'));
    const lng = parseFloat(url.searchParams.get('lng'));
    const radius = parseFloat(url.searchParams.get('radius')) || 50; // Default 50km
    const limit = parseInt(url.searchParams.get('limit')) || 10;

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Valid latitude and longitude are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use PostGIS function for nearby offices
    const { data: offices, error } = await supabase
      .rpc('nearby_offices', {
        lat,
        lng,
        radius_km: radius,
        limit_count: limit
      });

    if (error) throw error;

    // Calculate distances and enhance results
    const enhancedOffices = offices.map(office => {
      const distance = calculateDistance(lat, lng, office.latitude, office.longitude);
      
      return {
        ...office,
        distanceKm: Math.round(distance * 100) / 100,
        bearing: calculateBearing(lat, lng, office.latitude, office.longitude)
      };
    });

    // Sort by distance
    enhancedOffices.sort((a, b) => a.distanceKm - b.distanceKm);

    return new Response(JSON.stringify({
      success: true,
      data: enhancedOffices,
      searchCenter: { lat, lng },
      radiusKm: radius,
      total: enhancedOffices.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Nearby Offices API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Haversine distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate bearing between two points
function calculateBearing(lat1, lon1, lat2, lon2) {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = 
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const bearing = Math.atan2(y, x);
  return (toDeg(bearing) + 360) % 360;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

function toDeg(rad) {
  return rad * (180 / Math.PI);
}
