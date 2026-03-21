-- NASAKA IEBC: Fix Arusha/Kisumu Coordinate Overlap
-- This script removes the erroneous duplicate Kisumu Central office (ID 457)
-- which had coordinates pointing to Arusha, Tanzania (-2.5977, 35.9888).
-- The correct Kisumu Central record is ID 110.

BEGIN;

-- 1. Check if the record exists before deletion
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.iebc_offices WHERE id = 457) THEN
        RAISE NOTICE 'Deleting erroneous Kisumu Central record (ID: 457) located in Arusha...';
        DELETE FROM public.iebc_offices WHERE id = 457;
    ELSE
        RAISE NOTICE 'Record ID 457 not found. Already cleaned up?';
    END IF;
END $$;

-- 2. Verify ID 110 exists and has correct coordinates (Kisumu City)
-- Coordinates should be approx (-0.1031, 34.7561)
UPDATE public.iebc_offices
SET 
  latitude = -0.1030863,
  longitude = 34.7560645,
  notes = 'Verified Kisumu Central Headquarters. Coordinates corrected from Arusha overlap.'
WHERE id = 110;

COMMIT;
