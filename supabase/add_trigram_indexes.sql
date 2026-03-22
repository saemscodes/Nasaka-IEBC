`-- PHASE 2: Performance Optimization for Nasaka IEBC
-- Enables fuzzy search indexing for Counties, Constituencies, and Wards
-- Run this in the Supabase SQL Editor

-- 1. Enable pg_trgm extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Create GIN Trigram indexes for IEBC Offices
-- This speeds up `.ilike('%name%')` queries by 10-100x on larger datasets
CREATE INDEX IF NOT EXISTS idx_iebc_offices_county_trgm ON iebc_offices USING gin (county gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_iebc_offices_constituency_trgm ON iebc_offices USING gin (constituency gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_iebc_offices_constituency_name_trgm ON iebc_offices USING gin (constituency_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_iebc_offices_ward_trgm ON iebc_offices USING gin (ward gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_iebc_offices_location_trgm ON iebc_offices USING gin (office_location gin_trgm_ops);

-- 3. Create GIN Trigram indexes for Diaspora Centres
CREATE INDEX IF NOT EXISTS idx_diaspora_country_trgm ON diaspora_registration_centres USING gin (country gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_diaspora_mission_trgm ON diaspora_registration_centres USING gin (mission_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_diaspora_city_trgm ON diaspora_registration_centres USING gin (city gin_trgm_ops);

-- 4. Verification queries (optional)
-- EXPLAIN ANALYZE SELECT * FROM iebc_offices WHERE constituency_name ILIKE '%roysambu%';
`