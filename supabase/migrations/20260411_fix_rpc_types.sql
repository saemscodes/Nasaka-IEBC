-- Unified & Stabilized get_offices_in_bounds RPC
-- CONSIDERS: 100% Feature Parity (Metadata) + 100% Stability (Types) + 100% Performance (Zoom limits)
-- SUPERSEDES: 20260331_zoom_aware_viewport.sql, 20260401_rpc_unification.sql

-- 1. CLEANUP: Drop all possible signatures to prevent "Ambiguous Function" errors
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT oid::regprocedure as f_name FROM pg_proc WHERE proname = 'get_offices_in_bounds') LOOP
        EXECUTE 'DROP FUNCTION ' || r.f_name;
    END LOOP;
END $$;

-- 2. CREATE UNIFIED RPC
CREATE OR REPLACE FUNCTION get_offices_in_bounds(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
  zoom_level double precision default 15
)
RETURNS TABLE (
  id bigint,
  county text,
  constituency_name text,
  office_location text,
  latitude double precision,
  longitude double precision,
  verified boolean,
  type text,
  office_type text,
  landmark text,
  distance_from_landmark double precision,
  formatted_address text,
  ward text,
  category text,
  elevation_meters double precision,
  walking_effort double precision,
  landmark_normalized text,
  landmark_source text,
  isochrone_15min text,
  isochrone_30min text,
  isochrone_45min text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id::bigint,
    o.county,
    o.constituency_name,
    o.office_location,
    o.latitude::double precision,
    o.longitude::double precision,
    o.verified,
    'office'::text as type,
    o.office_type,
    o.landmark,
    COALESCE(o.distance_from_landmark::double precision, 0.0),
    o.formatted_address,
    o.ward,
    o.category,
    COALESCE(o.elevation_meters::double precision, 0.0),
    COALESCE(o.walking_effort::double precision, 1.0),
    o.landmark_normalized,
    o.landmark_source,
    o.isochrone_15min,
    o.isochrone_30min,
    o.isochrone_45min,
    o.created_at,
    o.updated_at
  FROM iebc_offices o
  WHERE o.latitude IS NOT NULL 
    AND o.longitude IS NOT NULL
    AND o.latitude >= min_lat 
    AND o.latitude <= max_lat 
    AND o.longitude >= min_lng 
    AND o.longitude <= max_lng
    AND o.verified = true
    AND (
      -- TIERED RENDERING (Zero-Shortcut Performance)
      -- Zoom >= 12: Show everything (Centres + Offices)
      -- Zoom < 12: Show only primary offices (CONSTITUENCY/COUNTY)
      (zoom_level >= 12) OR (o.office_type IN ('CONSTITUENCY_OFFICE', 'COUNTY_OFFICE'))
    )
  ORDER BY 
    CASE 
      WHEN zoom_level >= 12 THEN o.constituency_name
      ELSE o.county
    END,
    o.office_location
  LIMIT CASE 
    WHEN zoom_level >= 12 THEN 1000
    WHEN zoom_level >= 10 THEN 500
    WHEN zoom_level >= 8 THEN 200
    ELSE 50
  END;
END;
$$;

-- 3. PERMISSIONS
GRANT EXECUTE ON FUNCTION get_offices_in_bounds TO anon;
GRANT EXECUTE ON FUNCTION get_offices_in_bounds TO authenticated;
GRANT EXECUTE ON FUNCTION get_offices_in_bounds TO service_role;
