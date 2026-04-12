-- ============================================================================
-- NASAKA IEBC: GAZETTE DATA EXTENSION
-- 20260331 — Extends iebc_offices and wards for 40,000+ Registration Centres
-- ============================================================================

-- 1. EXTEND public.iebc_offices
ALTER TABLE public.iebc_offices
  ADD COLUMN IF NOT EXISTS centre_code TEXT,
  ADD COLUMN IF NOT EXISTS caw_code TEXT,
  ADD COLUMN IF NOT EXISTS county_code TEXT,
  ADD COLUMN IF NOT EXISTS ward_code TEXT,
  ADD COLUMN IF NOT EXISTS office_type TEXT DEFAULT 'REGISTRATION_CENTRE';

-- Update existing 290 offices to 'CONSTITUENCY_OFFICE'
-- We identify them by the absence of a centre_code
UPDATE public.iebc_offices 
SET office_type = 'CONSTITUENCY_OFFICE' 
WHERE centre_code IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_iebc_offices_type ON public.iebc_offices(office_type);
CREATE INDEX IF NOT EXISTS idx_iebc_offices_centre_code ON public.iebc_offices(centre_code);
CREATE INDEX IF NOT EXISTS idx_iebc_offices_caw_code ON public.iebc_offices(caw_code);
CREATE INDEX IF NOT EXISTS idx_iebc_offices_constituency_code ON public.iebc_offices(constituency_code);

-- 2. EXTEND public.wards
ALTER TABLE public.wards
  ADD COLUMN IF NOT EXISTS caw_code TEXT,
  ADD COLUMN IF NOT EXISTS registration_target INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registration_centre_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_wards_caw_code ON public.wards(caw_code);

-- 3. UNIQUE CONSTRAINT for Registration Centres
-- centre_code + constituency_code + county_code is a unique polling station ID
-- Note: constituency_code and county_code in the DB might be numeric or text depending on earlier migrations
-- we ensure they are treated consistently

-- 4. Deductive Linkage Trigger
-- Automatically links centres to the wards table if ward/constituency/county match
CREATE OR REPLACE FUNCTION public.sync_office_ward_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ward_id IS NULL THEN
        SELECT id INTO NEW.ward_id 
        FROM public.wards 
        WHERE (UPPER(ward_name) = UPPER(COALESCE(NEW.ward, NEW.constituency_name))) -- fallback to constituency if ward missing
        AND UPPER(constituency) = UPPER(NEW.constituency_name) 
        AND UPPER(county) = UPPER(NEW.county)
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_office_ward_id ON public.iebc_offices;
CREATE TRIGGER trigger_sync_office_ward_id
BEFORE INSERT OR UPDATE ON public.iebc_offices
FOR EACH ROW
EXECUTE FUNCTION public.sync_office_ward_id();

COMMENT ON COLUMN public.iebc_offices.office_type IS 'Distinguishes between main Constituency Offices and individual Polling Stations (Registration Centres)';
COMMENT ON COLUMN public.wards.registration_target IS 'Voter registration target for this ward as per Gazette 4491';
