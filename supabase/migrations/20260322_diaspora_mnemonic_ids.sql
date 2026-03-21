-- ============================================================================
-- NASAKA IEBC: DIASPORA MNEMONIC IDs & RPC UNIFIED
-- 20260322 — Transition from UUID to mnemonic TEXT IDs
-- ============================================================================

-- 1. DROP DEPENDENT FUNCTIONS FIRST (PostgreSQL requires this when changing return types)
DROP FUNCTION IF EXISTS find_nearest_kenyan_mission(FLOAT, FLOAT, diaspora_centre_state, TEXT, INT);
DROP FUNCTION IF EXISTS confirm_iebc_2027_centre(TEXT, CHAR, TEXT, TEXT, JSONB, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ);

-- 2. ALTER ID COLUMN TYPE
ALTER TABLE public.diaspora_registration_centres 
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE public.diaspora_registration_centres 
  ALTER COLUMN id TYPE TEXT;

-- 3. RECREATE RPC: find_nearest_kenyan_mission (Returns TEXT ID)
CREATE OR REPLACE FUNCTION find_nearest_kenyan_mission(
  search_lat        FLOAT,
  search_lng        FLOAT,
  filter_state      diaspora_centre_state DEFAULT NULL,
  filter_continent  TEXT DEFAULT NULL,
  max_results       INT DEFAULT 5
)
RETURNS TABLE (
  id                    TEXT,
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

-- 4. RECREATE RPC: confirm_iebc_2027_centre (Returns TEXT ID)
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
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  v_id TEXT;
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
