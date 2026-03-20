-- ============================================================================
-- NASAKA IEBC: FINAL HARMONIZATION & API RPCs
-- 20260321 — Unified Wards, Diaspora and Office Geolocation
-- ============================================================================

-- 1. SCHEMA ENHANCEMENTS (IDEMPOTENT)
-- ----------------------------------------------------------------------------

-- Wards
ALTER TABLE public.wards 
  ADD COLUMN IF NOT EXISTS total_voters INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS geocode_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS geocode_method TEXT,
  ADD COLUMN IF NOT EXISTS geocode_confidence DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS formatted_address TEXT;

-- IEBC Offices
ALTER TABLE public.iebc_offices
  ADD COLUMN IF NOT EXISTS ward TEXT,
  ADD COLUMN IF NOT EXISTS ward_id UUID; -- Not adding FK yet to avoid potential data-prep blocks

-- Diaspora
ALTER TABLE public.diaspora_registration_centres
  ADD COLUMN IF NOT EXISTS geocode_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS geocode_method TEXT,
  ADD COLUMN IF NOT EXISTS geocode_confidence DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS formatted_address TEXT;

-- 2. UPDATED GEO-SEARCH RPC (WARD-AWARE)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION search_offices_by_text_and_location_v2(
  search_query TEXT,
  search_lat FLOAT DEFAULT NULL,
  search_lng FLOAT DEFAULT NULL,
  radius_km FLOAT DEFAULT 50,
  max_results INT DEFAULT 10
)
RETURNS TABLE (
  id INTEGER,
  county TEXT,
  constituency_name TEXT,
  constituency TEXT,
  ward TEXT, -- NEW
  office_location TEXT,
  latitude FLOAT,
  longitude FLOAT,
  verified BOOLEAN,
  formatted_address TEXT,
  landmark TEXT,
  distance_km FLOAT,
  text_rank FLOAT,
  combined_score FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH
  text_matches AS (
    SELECT
      o.id,
      o.county,
      o.constituency_name,
      o.constituency,
      o.ward,
      o.office_location,
      o.latitude,
      o.longitude,
      o.verified,
      o.formatted_address,
      o.landmark,
      ts_rank(
        to_tsvector('english',
          COALESCE(o.county, '') || ' ' ||
          COALESCE(o.constituency_name, '') || ' ' ||
          COALESCE(o.constituency, '') || ' ' ||
          COALESCE(o.ward, '') || ' ' ||
          COALESCE(o.office_location, '') || ' ' ||
          COALESCE(o.landmark, '') || ' ' ||
          COALESCE(o.formatted_address, '')
        ),
        plainto_tsquery('english', search_query)
      )::FLOAT AS text_rank
    FROM public.iebc_offices o
    WHERE
      o.latitude IS NOT NULL
      AND o.longitude IS NOT NULL
      AND (
        search_query = '' OR search_query IS NULL OR
        to_tsvector('english',
          COALESCE(o.county, '') || ' ' ||
          COALESCE(o.constituency_name, '') || ' ' ||
          COALESCE(o.constituency, '') || ' ' ||
          COALESCE(o.ward, '') || ' ' ||
          COALESCE(o.office_location, '') || ' ' ||
          COALESCE(o.landmark, '') || ' ' ||
          COALESCE(o.formatted_address, '')
        ) @@ plainto_tsquery('english', search_query)
      )
  ),
  with_distance AS (
    SELECT
      tm.*,
      CASE
        WHEN search_lat IS NOT NULL AND search_lng IS NOT NULL THEN
          (6371 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(search_lat)) * cos(radians(tm.latitude)) *
              cos(radians(tm.longitude) - radians(search_lng)) +
              sin(radians(search_lat)) * sin(radians(tm.latitude))
            ))
          ))::FLOAT
        ELSE NULL
      END AS distance_km
    FROM text_matches tm
  )
  SELECT
    wd.id,
    wd.county,
    wd.constituency_name,
    wd.constituency,
    wd.ward,
    wd.office_location,
    wd.latitude,
    wd.longitude,
    wd.verified,
    wd.formatted_address,
    wd.landmark,
    wd.distance_km,
    wd.text_rank,
    (wd.text_rank *
      CASE
        WHEN wd.distance_km IS NULL THEN 1.0
        WHEN wd.distance_km = 0 THEN 10.0
        ELSE 1.0 / (1.0 + wd.distance_km / 10.0)
      END
    )::FLOAT AS combined_score
  FROM with_distance wd
  WHERE
    wd.distance_km IS NULL OR wd.distance_km <= radius_km
  ORDER BY combined_score DESC
  LIMIT max_results;
END;
$$;
