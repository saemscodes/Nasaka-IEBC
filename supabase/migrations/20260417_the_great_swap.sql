-- ============================================================================
-- NASAKA IEBC: THE GREAT SWAP (2026-04-17)
-- Performs a live content exchange between scraped centres and production offices.
-- ============================================================================

-- 1. Create Legacy Backup Table (Preserve Original Code & Records)
CREATE TABLE IF NOT EXISTS public.iebc_offices_legacy_backup AS 
SELECT * FROM public.iebc_offices;

COMMENT ON TABLE public.iebc_offices_legacy_backup IS 'Cold storage for 30k+ legacy/redundant IEBC office records (Pre-April 2026 Scrape)';

-- 2. Enhance Production Table with High-Fidelity RO Fields
ALTER TABLE public.iebc_offices
  ADD COLUMN IF NOT EXISTS returning_officer_name TEXT,
  ADD COLUMN IF NOT EXISTS returning_officer_email TEXT,
  ADD COLUMN IF NOT EXISTS raw_scrape_text TEXT,
  ADD COLUMN IF NOT EXISTS geocode_queries TEXT, -- User requested: "geocode queries and variations used separated by commas"
  ADD COLUMN IF NOT EXISTS geocode_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS geocode_method TEXT,
  ADD COLUMN IF NOT EXISTS geocode_confidence DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS mapping_uuid UUID; -- Link back to iebc_registration_centres for traceability

-- Ensure office_type exists and is indexed
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='iebc_offices' AND column_name='office_type') THEN
    ALTER TABLE public.iebc_offices ADD COLUMN office_type TEXT DEFAULT 'REGISTRATION_CENTRE';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_iebc_offices_mapping_uuid ON public.iebc_offices(mapping_uuid);
CREATE INDEX IF NOT EXISTS idx_iebc_offices_geocode_status ON public.iebc_offices(geocode_status);

-- 3. Transition: Move Signal to Production
-- We keep 'CONSTITUENCY_OFFICE' types (The 290 verified HQs)
-- We remove all other existing 'REGISTRATION_CENTRE' records to prevent duplicates with the new 24k set
DELETE FROM public.iebc_offices 
WHERE office_type = 'REGISTRATION_CENTRE';

-- 4. Initial Ingest (Signal Sync)
-- This moves the 24,369 verified centers into the production hub
INSERT INTO public.iebc_offices (
    name, 
    county, 
    constituency_name, 
    constituency, 
    ward,
    office_location, 
    centre_code,
    returning_officer_name, 
    returning_officer_email,
    office_type,
    mapping_uuid,
    verified
)
SELECT 
    name, 
    county, 
    constituency, 
    constituency, -- populated both for compatibility
    ward,
    name, -- office_location usually stores the Centre Name
    centre_code,
    returning_officer_name, 
    returning_officer_email,
    'REGISTRATION_CENTRE',
    id,
    true -- We have verified these via the official IEBC portal
FROM public.iebc_registration_centres;

-- 5. Status Log
DO $$
DECLARE
    new_count INT;
BEGIN
    SELECT count(*) INTO new_count FROM public.iebc_offices;
    RAISE NOTICE 'Migration Complete. Total records in iebc_offices: %', new_count;
END $$;
