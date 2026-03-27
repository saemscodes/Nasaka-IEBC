-- ============================================================================
-- NASAKA IEBC: POPULATE WARD CENTROIDS
-- Source: kenya_wards_centroids.json from Supabase map-data bucket
-- Approach: Use Supabase's http extension to fetch JSON, parse, and UPDATE
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Enable http extension (if not already)
CREATE EXTENSION IF NOT EXISTS http;

-- Step 2: Fetch JSON and update wards
DO $$
DECLARE
    response http_response;
    raw_content text;
    ward_data jsonb;
    ward_item jsonb;
    matched_count integer := 0;
    total_count integer := 0;
BEGIN
    -- Fetch the centroids JSON
    SELECT * INTO response FROM http_get('https://ftswzvqwxdwgkvfbwfpx.supabase.co/storage/v1/object/public/map-data/kenya_wards_centroids.json');
    
    IF response.status != 200 THEN
        RAISE EXCEPTION 'Failed to fetch centroids JSON: status %', response.status;
    END IF;
    
    -- Sanitize: source JSON has invalid NaN values in 'id' field (BELGUT, MAROTHILE, etc.)
    raw_content := response.content;
    raw_content := regexp_replace(raw_content, '("id"\s*:\s*)NaN', '\1null', 'g');
    
    ward_data := raw_content::jsonb;
    total_count := jsonb_array_length(ward_data);
    
    RAISE NOTICE 'Fetched % ward centroids from JSON', total_count;
    
    -- Update each ward
    FOR ward_item IN SELECT * FROM jsonb_array_elements(ward_data)
    LOOP
        UPDATE public.wards w
        SET
            latitude = (ward_item->>'lat')::double precision,
            longitude = (ward_item->>'lng')::double precision,
            total_voters = COALESCE((ward_item->>'pop')::integer, w.total_voters)
        WHERE
            LOWER(TRIM(w.ward_name)) = LOWER(TRIM(ward_item->>'name'))
            OR LOWER(TRIM(w.ward_name)) = LOWER(TRIM(REPLACE(ward_item->>'name', ' Ward', '')))
            OR LOWER(TRIM(REPLACE(w.ward_name, ' Ward', ''))) = LOWER(TRIM(REPLACE(ward_item->>'name', ' Ward', '')));
        
        IF FOUND THEN
            matched_count := matched_count + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Updated % of % wards with centroid data', matched_count, total_count;
END $$;

-- Step 3: Verify results
SELECT 
    COUNT(*) AS total_wards,
    COUNT(latitude) AS with_coordinates,
    COUNT(*) - COUNT(latitude) AS missing_coordinates,
    ROUND(COUNT(latitude)::numeric / NULLIF(COUNT(*)::numeric, 0) * 100, 1) AS coverage_pct
FROM public.wards;
