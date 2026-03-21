-- ============================================================================
-- NASAKA IEBC: SPATIAL ROUTING RPC
-- 20260321 — Adds proximity lookup for geographical slug resolution
-- ============================================================================

-- Enable PostGIS if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Function: get_nearest_ward
-- Resolves a lat/lng pair to the nearest ward centroid
CREATE OR REPLACE FUNCTION public.get_nearest_ward(lat_param double precision, lng_param double precision)
RETURNS TABLE (
    id uuid,
    ward_name text,
    constituency text,
    county text,
    latitude double precision,
    longitude double precision,
    distance_km double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id,
        w.ward_name,
        w.constituency,
        w.county,
        w.latitude,
        w.longitude,
        (6371 * acos(
            cos(radians(lat_param)) * cos(radians(w.latitude)) * 
            cos(radians(w.longitude) - radians(lng_param)) + 
            sin(radians(lat_param)) * sin(radians(w.latitude))
        )) as distance_km
    FROM public.wards w
    WHERE w.latitude IS NOT NULL AND w.longitude IS NOT NULL
    ORDER BY (
        point(w.longitude, w.latitude) <-> point(lng_param, lat_param)
    ) ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant access to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION public.get_nearest_ward(double precision, double precision) TO anon;
GRANT EXECUTE ON FUNCTION public.get_nearest_ward(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearest_ward(double precision, double precision) TO service_role;
