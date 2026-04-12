-- MIGRATION: 20260401_full_metadata_rpc.sql
-- PURPOSE: Redefine get_offices_in_bounds to return FULL metadata for OfficeBottomSheet
-- ADHERES TO: Zero-Deletion Policy & Full Metadata Requirement

DROP FUNCTION IF EXISTS public.get_offices_in_bounds(float, float, float, float, float);

CREATE OR REPLACE FUNCTION public.get_offices_in_bounds(
  min_lat float,
  min_lng float,
  max_lat float,
  max_lng float,
  zoom_level float DEFAULT 15
)
RETURNS TABLE (
  id bigint,
  county text,
  constituency_name text,
  office_location text,
  latitude float,
  longitude float,
  verified boolean,
  type text,
  office_type text,
  landmark text,
  distance_from_landmark double precision,
  formatted_address text,
  ward text,
  category text,
  elevation_meters double precision,
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
    o.latitude,
    o.longitude,
    o.verified,
    'office'::text as type,
    o.office_type,
    o.landmark,
    o.distance_from_landmark,
    o.formatted_address,
    o.ward,
    o.category,
    o.elevation_meters,
    o.walking_effort,
    o.landmark_normalized,
    o.landmark_source,
    o.isochrone_15min,
    o.isochrone_30min,
    o.isochrone_45min
  FROM public.iebc_offices o
  WHERE o.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  AND (
    -- TIERED VISIBILITY LOGIC (Server-Side Performance)
    -- Zoom >= 12: Show everything (Centers + Offices)
    -- Zoom < 12: Show only primary Offices (CONSTITUENCY/COUNTY)
    (zoom_level >= 12) OR (o.office_type IN ('CONSTITUENCY_OFFICE', 'COUNTY_OFFICE'))
  )
  LIMIT 5000;
END;
$$;
