-- HAMILTONIAN HIGH-FIDELITY IDENTITY PIPELINE (v1.0)
-- Objective: 100% Descriptive Coverage with Strict Prepositions

BEGIN;

-- 1. CLEAN FOUNDATIONS
UPDATE public.iebc_offices
SET clean_office_location = TRIM(
  REGEXP_REPLACE(
    office_location,
    '^(near|next to|opposite|along|at|behind|above|below|across from|off|past)\\\\s+',
    '',
    'i'
  )
)
WHERE (clean_office_location IS NULL OR clean_office_location = '')
  AND office_location IS NOT NULL;

-- 2. BULK INFERENCE (STRICT MODE)
-- We use a LATERAL JOIN to find the nearest physical structure from the categorical whitelist
UPDATE public.iebc_offices o
SET 
  direction_landmark = l.name,
  landmark = l.name,
  distance_from_landmark = l.dist,
  direction_type = CASE 
    WHEN l.bearing < 22.5 THEN 'N'
    WHEN l.bearing < 67.5 THEN 'NE'
    WHEN l.bearing < 112.5 THEN 'E'
    WHEN l.bearing < 157.5 THEN 'SE'
    WHEN l.bearing < 202.5 THEN 'S'
    WHEN l.bearing < 247.5 THEN 'SW'
    WHEN l.bearing < 292.5 THEN 'W'
    WHEN l.bearing < 337.5 THEN 'NW'
    ELSE 'N'
  END,
  office_location = CASE 
    WHEN l.dist > 200 THEN 
        o.clean_office_location || ', ' || ROUND(l.dist)::text || 'm ' || 
        (CASE 
            WHEN l.bearing < 22.5 THEN 'N'
            WHEN l.bearing < 67.5 THEN 'NE'
            WHEN l.bearing < 112.5 THEN 'E'
            WHEN l.bearing < 157.5 THEN 'SE'
            WHEN l.bearing < 202.5 THEN 'S'
            WHEN l.bearing < 247.5 THEN 'SW'
            WHEN l.bearing < 292.5 THEN 'W'
            WHEN l.bearing < 337.5 THEN 'NW'
            ELSE 'N'
        END) || ' of ' || l.name
    ELSE 
        o.clean_office_location || ', ' || 
        (CASE 
            WHEN l.dist < 5 THEN 'at'
            WHEN l.dist < 50 THEN 'opposite'
            WHEN l.dist < 150 THEN 'next to'
            ELSE 'near'
        END) || ' ' || l.name
  END,
  landmark_source = 'hamilton_v1',
  verified = true
FROM (
  SELECT DISTINCT ON (o2.id)
    o2.id,
    l2.name,
    ST_Distance(o2.geom::geography, l2.centroid_geom::geography) as dist,
    degrees(ST_Azimuth(o2.geom::geometry, l2.centroid_geom::geometry)) as bearing
  FROM public.iebc_offices o2
  CROSS JOIN LATERAL (
    SELECT name, centroid_geom
    FROM public.map_landmarks
    WHERE landmark_type IN (
      'school', 'hospital', 'place_of_worship', 'market', 
      'government', 'police', 'bus_station', 'fuel',
      'bank', 'pharmacy', 'post_office'
    )
    AND ST_DWithin(o2.geom, centroid_geom, 0.05) -- ~5km max
    ORDER BY o2.geom <-> centroid_geom
    LIMIT 1
  ) l2
  WHERE o2.latitude IS NOT NULL AND o2.longitude IS NOT NULL
) l
WHERE o.id = l.id;

-- 3. FALLBACK (AREA DESCRIPTORS)
UPDATE public.iebc_offices
SET 
  office_location = clean_office_location || ', within ' || COALESCE(ward, constituency_name, 'Registration') || ' Area',
  landmark = COALESCE(ward, constituency_name) || ' Area',
  landmark_source = 'hamilton_v1_fallback'
WHERE landmark_source IS NULL OR landmark_source = '';

COMMIT;
