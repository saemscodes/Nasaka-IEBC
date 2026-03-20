-- ============================================================================
-- NASAKA IEBC: WARD & DIASPORA SCHEMA ENHANCEMENT
-- 20260321 — Adds geocoding metadata and hierarchical links
-- ============================================================================

-- 1. ENHANCE public.wards
ALTER TABLE public.wards 
  ADD COLUMN IF NOT EXISTS total_voters INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS geocode_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS geocode_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geocode_method TEXT,
  ADD COLUMN IF NOT EXISTS multi_source_confidence DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS geocode_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS formatted_address TEXT;

-- Index for spatial and hierarchical queries
CREATE INDEX IF NOT EXISTS idx_wards_lat_lng ON public.wards(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_wards_hierarchy ON public.wards(county, constituency, ward_name);

-- 2. ENHANCE public.iebc_offices
ALTER TABLE public.iebc_offices
  ADD COLUMN IF NOT EXISTS ward TEXT,
  ADD COLUMN IF NOT EXISTS ward_id UUID REFERENCES public.wards(id);

-- Index for ward-level searches
CREATE INDEX IF NOT EXISTS idx_iebc_offices_ward ON public.iebc_offices(ward);
CREATE INDEX IF NOT EXISTS idx_iebc_offices_ward_id ON public.iebc_offices(ward_id);

-- 3. ENHANCE public.diaspora_registration_centres
ALTER TABLE public.diaspora_registration_centres
  ADD COLUMN IF NOT EXISTS geocode_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS geocode_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geocode_method TEXT,
  ADD COLUMN IF NOT EXISTS multi_source_confidence DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS geocode_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS formatted_address TEXT;

-- 4. UNIQUE CONSTRAINTS (STRICT MODE)
-- Handle existing duplicates before applying constraints would be ideal, 
-- but we define them here to prevent future divergence.
-- Note: These might fail if run on a dirty DB without prior cleanup via script.

-- County Unique
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'counties_name_key') THEN
        ALTER TABLE public.counties ADD CONSTRAINT counties_name_key UNIQUE (name);
    END IF;
END $$;

-- Constituency Unique (scoped to county)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'constituencies_name_county_key') THEN
        ALTER TABLE public.constituencies ADD CONSTRAINT constituencies_name_county_key UNIQUE (name, county_id);
    END IF;
END $$;

-- Ward Unique (scoped to constituency and county)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wards_full_path_key') THEN
        ALTER TABLE public.wards ADD CONSTRAINT wards_full_path_key UNIQUE (ward_name, constituency, county);
    END IF;
END $$;

-- 5. RPC: refresh_ward_counts
-- Updates total_voters in wards based on child registrations if applicable, 
-- or syncs from registration_target if that represents the ground truth.
CREATE OR REPLACE FUNCTION public.refresh_ward_metadata()
RETURNS VOID AS $$
BEGIN
    -- This function can be expanded as the data model for voter counts matures
    UPDATE public.wards
    SET total_voters = COALESCE(total_count, registration_target, 0)
    WHERE total_voters = 0;
END;
$$ LANGUAGE plpgsql;

SELECT public.refresh_ward_metadata();
