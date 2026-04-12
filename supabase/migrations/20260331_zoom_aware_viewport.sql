-- MIGRATION: 20260331_zoom_aware_viewport.sql
-- PURPOSE: Optimization of get_offices_in_bounds to handle 30k+ markers via zoom-level tiering

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
  office_type text
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
    o.office_type
  FROM public.iebc_offices o
  WHERE o.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  AND (
    -- TIERED VISIBILITY LOGIC (Server-Side)
    -- If zoom is low (< 10), only show constituency offices to prevent browser crash
    -- If zoom is medium (10-12), show everything but maybe we could limit? 
    -- For now, let's stick to:
    (zoom_level >= 10) OR (o.office_type = 'CONSTITUENCY_OFFICE')
  )
  LIMIT 5000; -- Safety cap to prevent accidental 30k return in one go
END;
$$;
