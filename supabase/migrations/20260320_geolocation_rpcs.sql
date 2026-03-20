-- 20260320_geolocation_rpcs.sql
-- Uber-style geolocation RPCs for Nasaka IEBC
-- Proximity search + text search with geographic bias

-- ============================================================================
-- 1. SPATIAL + FTS INDEXES ON iebc_offices
-- ============================================================================

-- Spatial index for bounding box pre-filter
CREATE INDEX IF NOT EXISTS idx_iebc_offices_lat_lng
  ON public.iebc_offices(latitude, longitude);

-- Full-text search index on searchable text columns
CREATE INDEX IF NOT EXISTS idx_iebc_offices_fts
  ON public.iebc_offices
  USING GIN(
    to_tsvector('english',
      COALESCE(county, '') || ' ' ||
      COALESCE(constituency_name, '') || ' ' ||
      COALESCE(constituency, '') || ' ' ||
      COALESCE(office_location, '') || ' ' ||
      COALESCE(landmark, '') || ' ' ||
      COALESCE(formatted_address, '')
    )
  );

-- ============================================================================
-- 2. find_offices_near_place — Uber-style proximity search
--    Bounding box pre-filter → Haversine exact distance → ORDER BY distance
-- ============================================================================

CREATE OR REPLACE FUNCTION find_offices_near_place(
  search_lat FLOAT,
  search_lng FLOAT,
  radius_km FLOAT DEFAULT 15,
  max_results INT DEFAULT 20
)
RETURNS TABLE (
  id INTEGER,
  county TEXT,
  constituency_name TEXT,
  constituency TEXT,
  office_location TEXT,
  latitude FLOAT,
  longitude FLOAT,
  verified BOOLEAN,
  formatted_address TEXT,
  landmark TEXT,
  clean_office_location TEXT,
  distance_km FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Step 1: Bounding box pre-filter (fast index scan on lat/lng)
  candidates AS (
    SELECT o.*
    FROM public.iebc_offices o
    WHERE
      o.latitude IS NOT NULL
      AND o.longitude IS NOT NULL
      AND o.verified = true
      AND o.latitude BETWEEN search_lat - (radius_km / 111.0)
                         AND search_lat + (radius_km / 111.0)
      AND o.longitude BETWEEN search_lng - (radius_km / (111.0 * cos(radians(search_lat))))
                           AND search_lng + (radius_km / (111.0 * cos(radians(search_lat))))
  ),
  -- Step 2: Exact Haversine distance calculation
  with_distance AS (
    SELECT
      c.id,
      c.county,
      c.constituency_name,
      c.constituency,
      c.office_location,
      c.latitude,
      c.longitude,
      c.verified,
      c.formatted_address,
      c.landmark,
      c.clean_office_location,
      (6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(search_lat)) * cos(radians(c.latitude)) *
          cos(radians(c.longitude) - radians(search_lng)) +
          sin(radians(search_lat)) * sin(radians(c.latitude))
        ))
      ))::FLOAT AS distance_km
    FROM candidates c
  )
  -- Step 3: Filter by exact radius and sort by distance
  SELECT wd.*
  FROM with_distance wd
  WHERE wd.distance_km <= radius_km
  ORDER BY wd.distance_km ASC
  LIMIT max_results;
END;
$$;

-- ============================================================================
-- 3. search_offices_by_text_and_location — text search + proximity ranking
--    Combines full-text relevance with geographic proximity decay
-- ============================================================================

CREATE OR REPLACE FUNCTION search_offices_by_text_and_location(
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
  office_location TEXT,
  latitude FLOAT,
  longitude FLOAT,
  verified BOOLEAN,
  formatted_address TEXT,
  landmark TEXT,
  clean_office_location TEXT,
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
  -- Step 1: Full-text search matches
  text_matches AS (
    SELECT
      o.id,
      o.county,
      o.constituency_name,
      o.constituency,
      o.office_location,
      o.latitude,
      o.longitude,
      o.verified,
      o.formatted_address,
      o.landmark,
      o.clean_office_location,
      ts_rank(
        to_tsvector('english',
          COALESCE(o.county, '') || ' ' ||
          COALESCE(o.constituency_name, '') || ' ' ||
          COALESCE(o.constituency, '') || ' ' ||
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
      AND o.verified = true
      AND (
        search_query = '' OR search_query IS NULL OR
        to_tsvector('english',
          COALESCE(o.county, '') || ' ' ||
          COALESCE(o.constituency_name, '') || ' ' ||
          COALESCE(o.constituency, '') || ' ' ||
          COALESCE(o.office_location, '') || ' ' ||
          COALESCE(o.landmark, '') || ' ' ||
          COALESCE(o.formatted_address, '')
        ) @@ plainto_tsquery('english', search_query)
      )
  ),
  -- Step 2: Add geographic distance
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
  -- Step 3: Combine text rank with proximity decay
  SELECT
    wd.id,
    wd.county,
    wd.constituency_name,
    wd.constituency,
    wd.office_location,
    wd.latitude,
    wd.longitude,
    wd.verified,
    wd.formatted_address,
    wd.landmark,
    wd.clean_office_location,
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

-- ============================================================================
-- 4. DIASPORA REGISTRATION CENTRES
-- ============================================================================

-- Designation state enum
DO $$ BEGIN
  CREATE TYPE diaspora_centre_state AS ENUM (
    'embassy_only',
    'embassy_probable',
    'iebc_confirmed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.diaspora_registration_centres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  mission_name          TEXT NOT NULL,
  mission_type          TEXT NOT NULL
    CHECK (mission_type IN ('high_commission', 'embassy', 'consulate', 'liaison')),
  city                  TEXT NOT NULL,
  country               TEXT NOT NULL,
  country_code          CHAR(2) NOT NULL,
  continent             TEXT NOT NULL
    CHECK (continent IN ('Africa','Europe','Americas','Asia','Oceania','MiddleEast')),
  region                TEXT,

  -- Coordinates
  latitude              FLOAT,
  longitude             FLOAT,
  address               TEXT,
  google_maps_url       TEXT,

  -- Contact
  phone                 TEXT,
  email                 TEXT,
  website_url           TEXT,
  whatsapp              TEXT,

  -- Core state field
  designation_state     diaspora_centre_state NOT NULL DEFAULT 'embassy_only',

  -- Historical designation record
  designated_2017       BOOLEAN DEFAULT false,
  designated_2022       BOOLEAN DEFAULT false,
  designation_count     INT DEFAULT 0,

  -- Current cycle (2027)
  is_iebc_confirmed_2027        BOOLEAN DEFAULT false,
  confirmed_2027_source_url     TEXT,
  confirmed_2027_gazette_ref    TEXT,
  services_2027                 JSONB,

  -- Registration windows
  registration_opens_at         TIMESTAMPTZ,
  registration_closes_at        TIMESTAMPTZ,
  voting_date                   TIMESTAMPTZ,
  registration_requirements     JSONB,

  -- Inquiry centre functionality
  inquiry_contact_name          TEXT,
  inquiry_contact_email         TEXT,
  inquiry_notes                 TEXT,

  -- Data quality
  verified_at           TIMESTAMPTZ,
  verification_source   TEXT,
  last_checked_at       TIMESTAMPTZ,
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-compute designation_count and state
CREATE OR REPLACE FUNCTION update_diaspora_designation_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.designation_count := (
    CASE WHEN NEW.designated_2017 THEN 1 ELSE 0 END +
    CASE WHEN NEW.designated_2022 THEN 1 ELSE 0 END
  );

  IF NEW.is_iebc_confirmed_2027 THEN
    NEW.designation_state := 'iebc_confirmed';
  ELSIF NEW.designation_count >= 2 THEN
    NEW.designation_state := 'embassy_probable';
  ELSE
    NEW.designation_state := 'embassy_only';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_diaspora_designation_count ON diaspora_registration_centres;
CREATE TRIGGER trg_update_diaspora_designation_count
BEFORE INSERT OR UPDATE ON public.diaspora_registration_centres
FOR EACH ROW EXECUTE FUNCTION update_diaspora_designation_count();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_diaspora_country_code   ON public.diaspora_registration_centres(country_code);
CREATE INDEX IF NOT EXISTS idx_diaspora_state          ON public.diaspora_registration_centres(designation_state);
CREATE INDEX IF NOT EXISTS idx_diaspora_continent      ON public.diaspora_registration_centres(continent);
CREATE INDEX IF NOT EXISTS idx_diaspora_confirmed_2027 ON public.diaspora_registration_centres(is_iebc_confirmed_2027);
CREATE INDEX IF NOT EXISTS idx_diaspora_lat_lng        ON public.diaspora_registration_centres(latitude, longitude);

-- RLS
ALTER TABLE public.diaspora_registration_centres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view diaspora centres"
  ON public.diaspora_registration_centres FOR SELECT
  USING (true);

-- ============================================================================
-- 5. SEED: confirmed historical diaspora data
-- ============================================================================

INSERT INTO public.diaspora_registration_centres (
  mission_name, mission_type, city, country, country_code, continent, region,
  designated_2017, designated_2022
) VALUES
-- AFRICA (designated in both 2017 and 2022)
('Kenya High Commission Kampala',       'high_commission', 'Kampala',      'Uganda',       'UG', 'Africa', 'East Africa',     true, true),
('Kenya High Commission Dar es Salaam', 'high_commission', 'Dar es Salaam','Tanzania',     'TZ', 'Africa', 'East Africa',     true, true),
('Kenya Consulate Arusha',              'consulate',       'Arusha',       'Tanzania',     'TZ', 'Africa', 'East Africa',     true, true),
('Kenya Embassy Kigali',                'embassy',         'Kigali',       'Rwanda',       'RW', 'Africa', 'East Africa',     true, true),
('Kenya Embassy Bujumbura',             'embassy',         'Bujumbura',    'Burundi',      'BI', 'Africa', 'East Africa',     true, true),
('Kenya High Commission Pretoria',      'high_commission', 'Pretoria',     'South Africa', 'ZA', 'Africa', 'Southern Africa', true, true),
-- AFRICA (2022 only)
('Kenya Embassy Juba',                  'embassy',         'Juba',         'South Sudan',  'SS', 'Africa', 'East Africa',     false, true),
-- AMERICAS (2022 only)
('Kenya Embassy Washington DC',         'embassy',         'Washington DC','United States','US', 'Americas','North America',  false, true),
('Kenya Consulate New York',            'consulate',       'New York',     'United States','US', 'Americas','North America',  false, true),
('Kenya Consulate Los Angeles',         'consulate',       'Los Angeles',  'United States','US', 'Americas','North America',  false, true),
('Kenya High Commission Ottawa',        'high_commission', 'Ottawa',       'Canada',       'CA', 'Americas','North America',  false, true),
('Kenya Consulate Toronto',             'consulate',       'Toronto',      'Canada',       'CA', 'Americas','North America',  false, true),
('Kenya Consulate Vancouver',           'consulate',       'Vancouver',    'Canada',       'CA', 'Americas','North America',  false, true),
-- EUROPE (2022 only)
('Kenya High Commission London',        'high_commission', 'London',       'United Kingdom','GB','Europe',  'Western Europe', false, true),
('Kenya Embassy Berlin',                'embassy',         'Berlin',       'Germany',      'DE', 'Europe',  'Western Europe', false, true),
-- MIDDLE EAST (2022 only)
('Kenya Embassy Abu Dhabi',             'embassy',         'Abu Dhabi',    'United Arab Emirates','AE','MiddleEast','Gulf',   false, true),
('Kenya Consulate Dubai',               'consulate',       'Dubai',        'United Arab Emirates','AE','MiddleEast','Gulf',   false, true),
('Kenya Embassy Doha',                  'embassy',         'Doha',         'Qatar',        'QA', 'MiddleEast','Gulf',         false, true),
-- ALL OTHER KENYAN MISSIONS (embassy_only — inquiry centres)
('Kenya Embassy Addis Ababa',           'embassy',         'Addis Ababa',  'Ethiopia',     'ET', 'Africa', 'East Africa',     false, false),
('Kenya High Commission Abuja',         'high_commission', 'Abuja',        'Nigeria',      'NG', 'Africa', 'West Africa',     false, false),
('Kenya Embassy Cairo',                 'embassy',         'Cairo',        'Egypt',        'EG', 'Africa', 'North Africa',    false, false),
('Kenya High Commission Harare',        'high_commission', 'Harare',       'Zimbabwe',     'ZW', 'Africa', 'Southern Africa', false, false),
('Kenya High Commission Lusaka',        'high_commission', 'Lusaka',       'Zambia',       'ZM', 'Africa', 'Southern Africa', false, false),
('Kenya Embassy Khartoum',              'embassy',         'Khartoum',     'Sudan',        'SD', 'Africa', 'East Africa',     false, false),
('Kenya High Commission Lilongwe',      'high_commission', 'Lilongwe',     'Malawi',       'MW', 'Africa', 'Southern Africa', false, false),
('Kenya Embassy Mogadishu',             'embassy',         'Mogadishu',    'Somalia',      'SO', 'Africa', 'East Africa',     false, false),
('Kenya Embassy Kinshasa',              'embassy',         'Kinshasa',     'DRC',          'CD', 'Africa', 'Central Africa',  false, false),
('Kenya High Commission Accra',         'high_commission', 'Accra',        'Ghana',        'GH', 'Africa', 'West Africa',     false, false),
('Kenya Embassy Paris',                 'embassy',         'Paris',        'France',       'FR', 'Europe', 'Western Europe',  false, false),
('Kenya Embassy Rome',                  'embassy',         'Rome',         'Italy',        'IT', 'Europe', 'Western Europe',  false, false),
('Kenya Embassy Brussels',              'embassy',         'Brussels',     'Belgium',      'BE', 'Europe', 'Western Europe',  false, false),
('Kenya Embassy Stockholm',             'embassy',         'Stockholm',    'Sweden',       'SE', 'Europe', 'Northern Europe', false, false),
('Kenya Embassy Moscow',                'embassy',         'Moscow',       'Russia',       'RU', 'Europe', 'Eastern Europe',  false, false),
('Kenya Embassy Madrid',                'embassy',         'Madrid',       'Spain',        'ES', 'Europe', 'Western Europe',  false, false),
('Kenya Embassy Vienna',                'embassy',         'Vienna',       'Austria',      'AT', 'Europe', 'Western Europe',  false, false),
('Kenya Embassy The Hague',             'embassy',         'The Hague',    'Netherlands',  'NL', 'Europe', 'Western Europe',  false, false),
('Kenya Embassy Tokyo',                 'embassy',         'Tokyo',        'Japan',        'JP', 'Asia',   'East Asia',       false, false),
('Kenya Embassy Beijing',               'embassy',         'Beijing',      'China',        'CN', 'Asia',   'East Asia',       false, false),
('Kenya Embassy New Delhi',             'embassy',         'New Delhi',    'India',        'IN', 'Asia',   'South Asia',      false, false),
('Kenya Embassy Bangkok',               'embassy',         'Bangkok',      'Thailand',     'TH', 'Asia',   'Southeast Asia',  false, false),
('Kenya Embassy Seoul',                 'embassy',         'Seoul',        'South Korea',  'KR', 'Asia',   'East Asia',       false, false),
('Kenya Embassy Riyadh',                'embassy',         'Riyadh',       'Saudi Arabia', 'SA', 'MiddleEast','Gulf',          false, false),
('Kenya Embassy Ankara',                'embassy',         'Ankara',       'Turkey',       'TR', 'MiddleEast','Levant',        false, false),
('Kenya High Commission Canberra',      'high_commission', 'Canberra',     'Australia',    'AU', 'Oceania','Oceania',         false, false),
('Kenya Embassy Brasilia',              'embassy',         'Brasilia',     'Brazil',       'BR', 'Americas','South America',  false, false)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. find_nearest_kenyan_mission — diaspora proximity search
-- ============================================================================

CREATE OR REPLACE FUNCTION find_nearest_kenyan_mission(
  search_lat        FLOAT,
  search_lng        FLOAT,
  filter_state      diaspora_centre_state DEFAULT NULL,
  filter_continent  TEXT DEFAULT NULL,
  max_results       INT DEFAULT 5
)
RETURNS TABLE (
  id                    UUID,
  mission_name          TEXT,
  mission_type          TEXT,
  city                  TEXT,
  country               TEXT,
  country_code          TEXT,
  continent             TEXT,
  latitude              FLOAT,
  longitude             FLOAT,
  address               TEXT,
  phone                 TEXT,
  email                 TEXT,
  website_url           TEXT,
  whatsapp              TEXT,
  designation_state     diaspora_centre_state,
  designation_count     INT,
  designated_2017       BOOLEAN,
  designated_2022       BOOLEAN,
  is_iebc_confirmed_2027 BOOLEAN,
  services_2027         JSONB,
  registration_opens_at TIMESTAMPTZ,
  registration_closes_at TIMESTAMPTZ,
  inquiry_notes         TEXT,
  distance_km           FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.mission_name,
    d.mission_type,
    d.city,
    d.country,
    d.country_code::TEXT,
    d.continent,
    d.latitude,
    d.longitude,
    d.address,
    d.phone,
    d.email,
    d.website_url,
    d.whatsapp,
    d.designation_state,
    d.designation_count,
    d.designated_2017,
    d.designated_2022,
    d.is_iebc_confirmed_2027,
    d.services_2027,
    d.registration_opens_at,
    d.registration_closes_at,
    d.inquiry_notes,
    (6371 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(search_lat)) * cos(radians(d.latitude)) *
        cos(radians(d.longitude) - radians(search_lng)) +
        sin(radians(search_lat)) * sin(radians(d.latitude))
      ))
    ))::FLOAT AS distance_km
  FROM public.diaspora_registration_centres d
  WHERE
    d.is_active = true
    AND d.latitude IS NOT NULL
    AND d.longitude IS NOT NULL
    AND (filter_state IS NULL OR d.designation_state = filter_state)
    AND (filter_continent IS NULL OR d.continent = filter_continent)
  ORDER BY distance_km ASC
  LIMIT max_results;
END;
$$;

-- ============================================================================
-- 7. confirm_iebc_2027_centre — activation function
-- ============================================================================

CREATE OR REPLACE FUNCTION confirm_iebc_2027_centre(
  p_city            TEXT,
  p_country_code    CHAR(2),
  p_gazette_ref     TEXT,
  p_source_url      TEXT,
  p_services        JSONB DEFAULT '["voter_registration"]'::JSONB,
  p_reg_opens       TIMESTAMPTZ DEFAULT NULL,
  p_reg_closes      TIMESTAMPTZ DEFAULT NULL,
  p_voting_date     TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  UPDATE public.diaspora_registration_centres
  SET
    is_iebc_confirmed_2027     = true,
    confirmed_2027_gazette_ref = p_gazette_ref,
    confirmed_2027_source_url  = p_source_url,
    services_2027              = p_services,
    registration_opens_at      = p_reg_opens,
    registration_closes_at     = p_reg_closes,
    voting_date                = p_voting_date
  WHERE
    LOWER(city) = LOWER(p_city)
    AND country_code = p_country_code
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
