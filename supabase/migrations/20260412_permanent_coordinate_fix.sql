-- 20260412_permanent_coordinate_fix.sql
-- Permanently correct swapped latitude/longitude values in iebc_offices table.
--
-- KENYA EXACT BOUNDING BOX (GADM / UN Cartographic Office verified)
--   Latitude:  -4.8386° S   to   4.9778° N
--   Longitude: 33.9099° E   to  41.9262° E
--
-- DETECTION LOGIC:
--   A row is swapped when:
--     stored "latitude" falls within Kenya's LONGITUDE range (33.9099 – 41.9262)
--     AND stored "longitude" falls within Kenya's LATITUDE range (-4.8386 – 4.9778)
--   This means the values were ingested in reverse order.

-- Step 1: Validate before applying — preview affected rows
-- SELECT id, county, office_location, latitude, longitude
-- FROM iebc_offices
-- WHERE latitude BETWEEN 33.9099 AND 41.9262
--   AND longitude BETWEEN -4.8386 AND 4.9778;

-- Step 2: Apply permanent swap with a transaction to allow rollback if needed
BEGIN;

UPDATE iebc_offices
SET
  latitude  = longitude,
  longitude = latitude,
  updated_at = now()
WHERE
  -- Stored "latitude" is actually a longitude (falls in Kenya lng range)
  latitude  BETWEEN 33.9099 AND 41.9262
  -- Stored "longitude" is actually a latitude (falls in Kenya lat range)
  AND longitude BETWEEN -4.8386 AND 4.9778;

-- Report how many rows were corrected
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Coordinate swap fix: % rows corrected.', affected_count;
END $$;

COMMIT;

-- Step 3: final verification — this should return 0 rows after the fix
-- SELECT COUNT(*) AS still_swapped
-- FROM iebc_offices
-- WHERE latitude BETWEEN 33.9099 AND 41.9262
--   AND longitude BETWEEN -4.8386 AND 4.9778;

-- Step 4: Grant (no change needed — existing row-level grants apply)
