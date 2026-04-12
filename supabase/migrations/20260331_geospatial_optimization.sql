-- MIGRATION: 20260331_geospatial_optimization.sql
-- PURPOSE: viewport fetching for 30k+ offices and performance indexing

-- 1. Ensure PostGIS is enabled (should be, but defensive)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add location column if it doesn't exist for high-perf spatial queries
-- We already have latitude/longitude, but a geometry(Point, 4326) column is faster for ST_Intersects
ALTER TABLE public.iebc_offices ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- 3. Populate geom column from lat/lng
UPDATE public.iebc_offices 
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 4. Add GIST Index
CREATE INDEX IF NOT EXISTS iebc_offices_geom_idx ON public.iebc_offices USING GIST (geom);

-- 5. Bulk Verification Update
-- As requested, set all to verified to enable viewing in current frontend filters
UPDATE public.iebc_offices SET verified = true;

-- 6. RPC: get_offices_in_bounds
-- Fetches offices within a bounding box (min_lat, min_lng, max_lat, max_lng)
CREATE OR REPLACE FUNCTION public.get_offices_in_bounds(
  min_lat float,
  min_lng float,
  max_lat float,
  max_lng float
)
RETURNS TABLE (
  id bigint,
  county text,
  constituency_name text,
  office_location text,
  latitude float,
  longitude float,
  verified boolean,
  type text
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
    o.latitude,
    o.longitude,
    o.verified,
    'office'::text as type
  FROM public.iebc_offices o
  WHERE o.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326);
END;
$$;
