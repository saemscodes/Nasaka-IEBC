-- MIGRATION: 20260401_rpc_unification.sql
-- PURPOSE: Resolve function overloading collisions (Error 42725)
-- ADHERES TO: Zero-Deletion Policy & Multi-Signature Cleanup

-- 1. CLEANUP: Drop all possible signatures to prevent "Ambiguous Function" errors
DROP FUNCTION IF EXISTS public.get_offices_in_bounds(double precision, double precision, double precision, double precision);
DROP FUNCTION IF EXISTS public.get_offices_in_bounds(double precision, double precision, double precision, double precision, double precision);
DROP FUNCTION IF EXISTS public.get_offices_in_bounds(numeric, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.get_offices_in_bounds(numeric, numeric, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.get_offices_in_bounds(float, float, float, float);
DROP FUNCTION IF EXISTS public.get_offices_in_bounds(float, float, float, float, float);

-- 2. UNIFICATION: Provide a single, definitive signature
-- Using FLOAT8 (double precision) which is the most compatible with PostGIS and PostgREST
CREATE OR REPLACE FUNCTION public.get_offices_in_bounds(
  min_lat float8,
  min_lng float8,
  max_lat float8,
  max_lng float8,
  zoom_level float8 DEFAULT 15
)
RETURNS TABLE (
  id bigint,
  county text,
  constituency_name text,
  office_location text,
  latitude float8,
  longitude float8,
  verified boolean,
  type text,
  office_type text,
  landmark text,
  distance_from_landmark float8,
  formatted_address text,
  ward text,
  category text,
  elevation_meters float8,
  walking_effort text,
  landmark_normalized text,
  landmark_source text,
  isochrone_15min text,
  isochrone_30min text,
  isochrone_45min text
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.county,
    o.constituency_name,
    o.office_location,
    o.latitude::float8,
    o.longitude::float8,
    o.verified,
    'office'::text as type,
    o.office_type,
    o.landmark,
    o.distance_from_landmark::float8,
    o.formatted_address,
    o.ward,
    o.category,
    o.elevation_meters::float8,
    o.walking_effort,
    o.landmark_normalized,
    o.landmark_source,
    o.isochrone_15min,
    o.isochrone_30min,
    o.isochrone_45min
  FROM public.iebc_offices o
  WHERE o.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  AND (
    -- TIERED RENDERING: Logic dictates detail (Centres) only at high zoom
    -- Zoom >= 12: Show everything (Centers + Offices)
    -- Zoom < 12: Show only primary Offices (CONSTITUENCY/COUNTY)
    (zoom_level >= 12) OR (o.office_type IN ('CONSTITUENCY_OFFICE', 'COUNTY_OFFICE'))
  )
  LIMIT 5000;
END;
$$;
