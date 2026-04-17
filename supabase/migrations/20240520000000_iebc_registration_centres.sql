-- Migration: iebc_registration_centres
-- Run this against your Supabase project via the SQL editor or CLI
-- before executing the scraper or geocoder.

-- ============================================================
-- TABLE: iebc_registration_centres
-- Stores every registration/polling centre scraped from
-- https://www.iebc.or.ke/registration/?where
-- ============================================================

CREATE TABLE IF NOT EXISTS public.iebc_registration_centres (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT          NOT NULL,
  county                    TEXT          NOT NULL,
  constituency              TEXT          NOT NULL,
  ward                      TEXT,
  centre_code               TEXT,
  returning_officer_name    TEXT,
  returning_officer_email   TEXT,
  
  -- Location / Geocoding Precision Fields
  latitude                  DOUBLE PRECISION,
  longitude                 DOUBLE PRECISION,
  geocode_confidence       FLOAT         DEFAULT 0,
  google_place_id           TEXT,
  location_type            TEXT, -- ROOFTOP, RANGE_INTERPOLATED, etc.
  location_source          TEXT, -- 'google', 'census', 'manual'
  
  raw_text                  TEXT,
  scraped_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT iebc_registration_centres_unique
    UNIQUE (name, county, constituency)
);

-- Defensive Column Check (Adds missing fields to existing tables)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='iebc_registration_centres' AND column_name='latitude') THEN
    ALTER TABLE public.iebc_registration_centres ADD COLUMN latitude DOUBLE PRECISION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='iebc_registration_centres' AND column_name='longitude') THEN
    ALTER TABLE public.iebc_registration_centres ADD COLUMN longitude DOUBLE PRECISION;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='iebc_registration_centres' AND column_name='geocode_confidence') THEN
    ALTER TABLE public.iebc_registration_centres ADD COLUMN geocode_confidence FLOAT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='iebc_registration_centres' AND column_name='google_place_id') THEN
    ALTER TABLE public.iebc_registration_centres ADD COLUMN google_place_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='iebc_registration_centres' AND column_name='location_type') THEN
    ALTER TABLE public.iebc_registration_centres ADD COLUMN location_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='iebc_registration_centres' AND column_name='location_source') THEN
    ALTER TABLE public.iebc_registration_centres ADD COLUMN location_source TEXT;
  END IF;
END $$;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_iebc_rc_county
  ON public.iebc_registration_centres (county);

CREATE INDEX IF NOT EXISTS idx_iebc_rc_constituency
  ON public.iebc_registration_centres (constituency);

CREATE INDEX IF NOT EXISTS idx_iebc_rc_location
  ON public.iebc_registration_centres (latitude, longitude)
  WHERE latitude IS NOT NULL;

-- Full-text search index
DROP INDEX IF EXISTS idx_iebc_rc_fts;
CREATE INDEX idx_iebc_rc_fts
  ON public.iebc_registration_centres
  USING GIN (
    to_tsvector(
      'english',
      COALESCE(name, '') || ' ' ||
      COALESCE(county, '') || ' ' ||
      COALESCE(constituency, '') || ' ' ||
      COALESCE(ward, '') || ' ' ||
      COALESCE(centre_code, '') || ' ' ||
      COALESCE(returning_officer_name, '')
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_iebc_rc_updated_at ON public.iebc_registration_centres;
CREATE TRIGGER trg_iebc_rc_updated_at
  BEFORE UPDATE ON public.iebc_registration_centres
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.iebc_registration_centres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "iebc_rc_public_read" ON public.iebc_registration_centres;
CREATE POLICY "iebc_rc_public_read"
  ON public.iebc_registration_centres
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "iebc_rc_service_role_write" ON public.iebc_registration_centres;
CREATE POLICY "iebc_rc_service_role_write"
  ON public.iebc_registration_centres
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Enhanced Search Function
DROP FUNCTION IF EXISTS public.search_registration_centres(TEXT);
CREATE OR REPLACE FUNCTION public.search_registration_centres(query TEXT)
RETURNS TABLE (
  id                        UUID,
  name                      TEXT,
  county                    TEXT,
  constituency              TEXT,
  ward                      TEXT,
  centre_code               TEXT,
  returning_officer_name    TEXT,
  returning_officer_email   TEXT,
  latitude                  DOUBLE PRECISION,
  longitude                 DOUBLE PRECISION,
  geocode_confidence       FLOAT,
  rank                      FLOAT4
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    name,
    county,
    constituency,
    ward,
    centre_code,
    returning_officer_name,
    returning_officer_email,
    latitude,
    longitude,
    geocode_confidence,
    ts_rank(
      to_tsvector(
        'english',
        COALESCE(name, '') || ' ' ||
        COALESCE(county, '') || ' ' ||
        COALESCE(constituency, '') || ' ' ||
        COALESCE(ward, '') || ' ' ||
        COALESCE(returning_officer_name, '')
      ),
      plainto_tsquery('english', query)
    ) AS rank
  FROM public.iebc_registration_centres
  WHERE to_tsvector(
    'english',
    COALESCE(name, '') || ' ' ||
    COALESCE(county, '') || ' ' ||
    COALESCE(constituency, '') || ' ' ||
    COALESCE(ward, '') || ' ' ||
    COALESCE(returning_officer_name, '')
  ) @@ plainto_tsquery('english', query)
  ORDER BY rank DESC
  LIMIT 50;
$$;
