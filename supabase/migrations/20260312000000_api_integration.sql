-- Migration: API Integration for Nasaka IEBC
-- Adds elevation, isochrone, and landmark normalization columns to iebc_offices
-- Adds geocoding_service_log for tracking external API usage

-- ============================================================================
-- 1. ADD NEW COLUMNS TO iebc_offices
-- ============================================================================
ALTER TABLE public.iebc_offices
  ADD COLUMN IF NOT EXISTS elevation_meters NUMERIC,
  ADD COLUMN IF NOT EXISTS isochrone_15min JSONB,
  ADD COLUMN IF NOT EXISTS isochrone_30min JSONB,
  ADD COLUMN IF NOT EXISTS isochrone_45min JSONB,
  ADD COLUMN IF NOT EXISTS landmark_normalized TEXT,
  ADD COLUMN IF NOT EXISTS landmark_source TEXT,
  ADD COLUMN IF NOT EXISTS walking_effort TEXT CHECK (walking_effort IN ('low', 'moderate', 'high', 'extreme'));

COMMENT ON COLUMN public.iebc_offices.elevation_meters IS 'Altitude in meters above sea level from Open Topo Data';
COMMENT ON COLUMN public.iebc_offices.isochrone_15min IS 'GeoJSON polygon: area reachable within 15 min walking from OpenRouteService';
COMMENT ON COLUMN public.iebc_offices.isochrone_30min IS 'GeoJSON polygon: area reachable within 30 min walking from OpenRouteService';
COMMENT ON COLUMN public.iebc_offices.isochrone_45min IS 'GeoJSON polygon: area reachable within 45 min walking from OpenRouteService';
COMMENT ON COLUMN public.iebc_offices.landmark_normalized IS 'Nearest verified landmark name from Nominatim reverse geocoding';
COMMENT ON COLUMN public.iebc_offices.landmark_source IS 'Source of the normalized landmark (nominatim, opencage, manual)';
COMMENT ON COLUMN public.iebc_offices.walking_effort IS 'Computed from elevation: low (<200m), moderate (200-800m), high (800-1500m), extreme (>1500m)';

-- ============================================================================
-- 2. ADD INDEX FOR WALKING EFFORT QUERIES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_iebc_offices_walking_effort ON public.iebc_offices(walking_effort);
CREATE INDEX IF NOT EXISTS idx_iebc_offices_elevation ON public.iebc_offices(elevation_meters);

-- ============================================================================
-- 3. GEOCODING SERVICE LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.geocoding_service_log (
  id BIGSERIAL PRIMARY KEY,
  service_name TEXT NOT NULL CHECK (service_name IN ('nominatim', 'opencage', 'openrouteservice', 'opentopo', 'ipapi')),
  request_type TEXT NOT NULL CHECK (request_type IN ('forward_geocode', 'reverse_geocode', 'isochrone', 'elevation', 'ip_geolocation', 'routing')),
  query_text TEXT,
  office_id INTEGER REFERENCES public.iebc_offices(id) ON DELETE SET NULL,
  response_status INTEGER,
  response_time_ms INTEGER,
  credits_used INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geocoding_log_service ON public.geocoding_service_log(service_name);
CREATE INDEX IF NOT EXISTS idx_geocoding_log_created ON public.geocoding_service_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_geocoding_log_office ON public.geocoding_service_log(office_id);

ALTER TABLE public.geocoding_service_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view geocoding logs"
  ON public.geocoding_service_log FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert geocoding logs"
  ON public.geocoding_service_log FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.geocoding_service_log IS 'Tracks usage of external geocoding/routing APIs for rate limit monitoring';

-- ============================================================================
-- 4. RPC FUNCTION: GET OFFICES WITH WALKING EFFORT
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_offices_by_walking_effort(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.get_offices_by_walking_effort(
  effort_level TEXT,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id INTEGER,
  county TEXT,
  constituency_name TEXT,
  office_location TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  elevation_meters NUMERIC,
  walking_effort TEXT,
  landmark_normalized TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.county,
    o.constituency_name,
    o.office_location,
    o.latitude,
    o.longitude,
    o.elevation_meters,
    o.walking_effort,
    o.landmark_normalized
  FROM public.iebc_offices o
  WHERE o.verified = true
    AND o.walking_effort = effort_level
    AND o.latitude IS NOT NULL
    AND o.longitude IS NOT NULL
  ORDER BY o.elevation_meters DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_offices_by_walking_effort IS 'Get offices filtered by walking effort level (low/moderate/high/extreme)';

-- ============================================================================
-- 5. RPC FUNCTION: GET OFFICES WITH ISOCHRONE DATA
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_office_isochrone(INTEGER);

CREATE OR REPLACE FUNCTION public.get_office_isochrone(office_id_param INTEGER)
RETURNS TABLE (
  id INTEGER,
  county TEXT,
  constituency_name TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  elevation_meters NUMERIC,
  walking_effort TEXT,
  landmark_normalized TEXT,
  isochrone_15min JSONB,
  isochrone_30min JSONB,
  isochrone_45min JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.county,
    o.constituency_name,
    o.latitude,
    o.longitude,
    o.elevation_meters,
    o.walking_effort,
    o.landmark_normalized,
    o.isochrone_15min,
    o.isochrone_30min,
    o.isochrone_45min
  FROM public.iebc_offices o
  WHERE o.id = office_id_param
    AND o.verified = true;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_office_isochrone IS 'Get isochrone (reachability) polygons for a specific office';
