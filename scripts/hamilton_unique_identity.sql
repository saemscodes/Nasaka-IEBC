-- HAMILTONIAN UNIQUE IDENTITY PIPELINE (v1.6)
-- Objective: 100% Unique Descriptive Coverage (Max 2 offices per landmark)

SET statement_timeout = '20min';
BEGIN;

-- 1. CLEAN FOUNDATIONS
UPDATE public.iebc_offices
SET 
  clean_office_location = TRIM(
    REGEXP_REPLACE(
      office_location,
      ',.*$',  
      '',
      'i'
    )
  ),
  landmark = NULL,
  landmark_source = NULL,
  direction_landmark = NULL,
  direction_type = NULL,
  distance_from_landmark = NULL;

-- 2. BULK INFERENCE (UNIQUE MODE)
-- We use a CTE to rank landmarks for each office, then use a second pass to pick unique winners.
WITH RankedLandmarks AS (
  SELECT 
    o.id as office_id,
    l.id as landmark_id,
    l.name as landmark_name,
    l.landmark_type,
    ST_Distance(o.geom, l.centroid_geom::geography) as dist,
    degrees(ST_Azimuth(l.centroid_geom::geometry, o.geom::geometry)) as bearing,
    ROW_NUMBER() OVER (PARTITION BY o.id ORDER BY ST_Distance(o.geom, l.centroid_geom::geography)) as landmark_rank
  FROM public.iebc_offices o
  CROSS JOIN LATERAL (
    SELECT id, name, centroid_geom, landmark_type
    FROM public.map_landmarks
    WHERE ST_DWithin(o.geom::geometry, centroid_geom, 0.01) -- STRICT 1KM
      AND (name NOT ILIKE '%' || o.clean_office_location || '%' AND o.clean_office_location NOT ILIKE '%' || name || '%')
    ORDER BY o.geom::geometry <-> centroid_geom
    LIMIT 3 -- We look at top 3 to allow fallback for uniqueness
  ) l
  WHERE o.latitude IS NOT NULL AND o.longitude IS NOT NULL
),
UniqueWinners AS (
  SELECT 
    office_id,
    landmark_id,
    landmark_name,
    dist,
    bearing,
    landmark_type
  FROM (
    SELECT 
      office_id, landmark_id, landmark_name, dist, bearing, landmark_type,
      ROW_NUMBER() OVER (PARTITION BY landmark_id ORDER BY dist ASC) as usage_rank
    FROM RankedLandmarks
  ) sub
  WHERE usage_rank <= 2 -- STRICT: Max 2 offices per landmark
)
UPDATE public.iebc_offices o
SET 
  direction_landmark = uw.landmark_name,
  landmark = uw.landmark_name,
  distance_from_landmark = uw.dist,
  direction_type = CASE 
    WHEN uw.bearing < 22.5 THEN 'N'
    WHEN uw.bearing < 67.5 THEN 'NE'
    WHEN uw.bearing < 112.5 THEN 'E'
    WHEN uw.bearing < 157.5 THEN 'SE'
    WHEN uw.bearing < 202.5 THEN 'S'
    WHEN uw.bearing < 247.5 THEN 'SW'
    WHEN uw.bearing < 292.5 THEN 'W'
    WHEN uw.bearing < 337.5 THEN 'NW'
    ELSE 'N'
  END,
  office_location = CASE 
    WHEN uw.dist > 150 THEN 
        o.clean_office_location || ', ' || ROUND(uw.dist)::text || 'm ' || 
        (CASE 
            WHEN uw.bearing < 22.5 THEN 'N'
            WHEN uw.bearing < 67.5 THEN 'NE'
            WHEN uw.bearing < 112.5 THEN 'E'
            WHEN uw.bearing < 157.5 THEN 'SE'
            WHEN uw.bearing < 202.5 THEN 'S'
            WHEN uw.bearing < 247.5 THEN 'SW'
            WHEN uw.bearing < 292.5 THEN 'W'
            WHEN uw.bearing < 337.5 THEN 'NW'
            ELSE 'N'
        END) || ' of ' || uw.landmark_name
    ELSE 
        o.clean_office_location || ', ' || 
        (CASE 
            WHEN uw.dist < 5 THEN 'at'
            WHEN uw.dist < 50 THEN 'opposite'
            WHEN uw.dist < 120 THEN 'next to'
            ELSE 'near'
        END) || ' ' || uw.landmark_name
  END,
  landmark_source = 'hamilton_v1',
  verified = true
FROM UniqueWinners uw
WHERE o.id = uw.office_id;

COMMIT;
