-- ============================================================================
-- NASAKA IEBC: COUNTY NAME NORMALIZATION
-- Fixes the 54-county bug by normalizing county names in iebc_offices
-- to the canonical 47 Kenyan county names.
-- Run this in Supabase SQL Editor ONCE.
-- ============================================================================

-- Step 1: Find and display the duplicate/variant county names
-- (Run this SELECT first to see what needs fixing before applying UPDATEs)
-- SELECT county, COUNT(*) as count
-- FROM iebc_offices
-- GROUP BY county
-- ORDER BY county;

-- Step 2: Normalize known variants
-- Hyphenated / space / slash variants
UPDATE iebc_offices SET county = 'TANA RIVER' WHERE UPPER(TRIM(county)) IN ('TANARIVER', 'TANA-RIVER', 'TANA RIVER COUNTY');
UPDATE iebc_offices SET county = 'TAITA TAVETA' WHERE UPPER(TRIM(county)) IN ('TAITA-TAVETA', 'TAITA/TAVETA', 'TAITA / TAVETA', 'TAITA TAVETA COUNTY');
UPDATE iebc_offices SET county = 'THARAKA-NITHI' WHERE UPPER(TRIM(county)) IN ('THARAKA NITHI', 'THARAKA NITHI ', 'THARAKA  NITHI', 'THARAKA - NITHI', 'THARAKA / NITHI');
UPDATE iebc_offices SET county = 'MURANG''A' WHERE UPPER(TRIM(county)) IN ('MURANGA', 'MURANG A', 'MURANG''A ', 'MURANG''A COUNTY');
UPDATE iebc_offices SET county = 'WEST POKOT' WHERE UPPER(TRIM(county)) IN ('WESTPOKOT', 'WEST-POKOT', 'WEST POKOT COUNTY');
UPDATE iebc_offices SET county = 'TRANS-NZOIA' WHERE UPPER(TRIM(county)) IN ('TRANS NZOIA', 'TRANSNZOIA', 'TRANS NZOIA ', 'TRANS-NZOIA COUNTY');
UPDATE iebc_offices SET county = 'UASIN GISHU' WHERE UPPER(TRIM(county)) IN ('UASINGISHU', 'UASIN-GISHU', 'UASIN GISHU ', 'UASIN GISHU COUNTY');
UPDATE iebc_offices SET county = 'ELGEYO-MARAKWET' WHERE UPPER(TRIM(county)) IN ('ELGEYO MARAKWET', 'ELGEYO/MARAKWET', 'KEIYO-MARAKWET', 'KEIYO MARAKWET', 'ELEGEYO-MARAKWET', 'ELGEYO MARAKWET COUNTY', 'ELGEYO-MARAKWET COUNTY');
UPDATE iebc_offices SET county = 'HOMA BAY' WHERE UPPER(TRIM(county)) IN ('HOMABAY', 'HOMA-BAY', 'HOMA BAY COUNTY');
UPDATE iebc_offices SET county = 'NAIROBI' WHERE UPPER(TRIM(county)) IN ('NAIROBI CITY', 'NAIROBI COUNTY');

-- Step 3: Trim and Upper Case on all remaining
UPDATE iebc_offices SET county = UPPER(TRIM(county)) WHERE county != UPPER(TRIM(county));

-- Step 4: Verify — this should return exactly 47 rows
-- SELECT county, COUNT(*) as office_count
-- FROM iebc_offices
-- GROUP BY county
-- ORDER BY county;

