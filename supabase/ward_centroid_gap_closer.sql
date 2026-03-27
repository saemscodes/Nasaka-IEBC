-- ============================================================================
-- NASAKA IEBC: WARD CENTROID GAP CLOSER (Second Pass)
-- Fixes the 178 unmatched wards with aggressive fuzzy matching
-- Run AFTER populate_ward_centroids.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS http;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Helper: strip everything except lowercase alphanumeric
CREATE OR REPLACE FUNCTION _ward_normalize(input text) RETURNS text AS $fn$
BEGIN
    -- Collapse spaces, strip non-alphanumeric except space, lowercase
    RETURN LOWER(regexp_replace(regexp_replace(TRIM(COALESCE(input, '')), '[^a-z0-9\s]', '', 'gi'), '\s+', ' ', 'g'));
END;
$fn$ LANGUAGE plpgsql IMMUTABLE;

DO $block$
DECLARE
    response http_response;
    raw_content text;
    ward_data jsonb;
    ward_item jsonb;
    matched_count integer := 0;
    jname text;
    jname_clean text;
    jcounty_clean text;
BEGIN
    SELECT * INTO response FROM http_get(
        'https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/kenya_wards_centroids.json'
    );
    raw_content := regexp_replace(response.content, '"id"\s*:\s*NaN', '"id":null', 'g');
    ward_data := raw_content::jsonb;

    FOR ward_item IN SELECT * FROM jsonb_array_elements(ward_data)
    LOOP
        jname := ward_item ->> 'name';
        jname_clean := _ward_normalize(regexp_replace(jname, '\mWard\M', '', 'gi'));
        jcounty_clean := _ward_normalize(ward_item ->> 'county');

        -- Manual overrides for known corrupted/special names
        IF jname_clean = 'emsoo' THEN jname_clean := 'ems00'; END IF;
        IF jname_clean = 'nambobotonambuku' THEN jname_clean := 'namb0b0tonambuku'; END IF;

        -- Only update wards still missing coordinates, constrained to same county
        UPDATE public.wards w
        SET
            latitude  = (ward_item ->> 'lat')::double precision,
            longitude = (ward_item ->> 'lng')::double precision,
            total_voters = COALESCE((ward_item ->> 'pop')::integer, w.total_voters)
        WHERE w.latitude IS NULL
          AND _ward_normalize(w.county) = jcounty_clean
          AND (
              -- Normalized exact match
              _ward_normalize(regexp_replace(w.ward_name, '\mWard\M', '', 'gi')) = jname_clean
              -- Word-shuffling check (handles North Kabuoch vs Kabuoch North)
              OR (
                  string_to_array(_ward_normalize(w.ward_name), ' ') <@ string_to_array(jname_clean, ' ')
                  AND string_to_array(jname_clean, ' ') <@ string_to_array(_ward_normalize(w.ward_name), ' ')
              )
              -- Substring containment (both directions, min 4 chars)
              OR (LENGTH(jname_clean) >= 4 AND (
                  _ward_normalize(w.ward_name) LIKE '%' || jname_clean || '%'
                  OR jname_clean LIKE '%' || _ward_normalize(w.ward_name) || '%'
              ))
              -- Levenshtein distance <= 2
              OR (LENGTH(jname_clean) BETWEEN 4 AND 25
                  AND levenshtein(
                      _ward_normalize(regexp_replace(w.ward_name, '\mWard\M', '', 'gi')),
                      jname_clean
                  ) <= 2
              )
          );

        IF FOUND THEN
            matched_count := matched_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE 'Second pass matched % additional wards', matched_count;
END $block$;

-- Cleanup helper
DROP FUNCTION IF EXISTS _ward_normalize(text);

-- Coverage check
SELECT 
    COUNT(*) AS total_wards,
    COUNT(latitude) AS with_coordinates,
    COUNT(*) - COUNT(latitude) AS still_missing,
    ROUND(COUNT(latitude)::numeric / NULLIF(COUNT(*)::numeric, 0) * 100, 1) AS coverage_pct
FROM public.wards;

-- Remaining unmatched
SELECT w.id, w.ward_name, w.county, w.constituency
FROM public.wards w
WHERE w.latitude IS NULL
ORDER BY w.county, w.ward_name;
