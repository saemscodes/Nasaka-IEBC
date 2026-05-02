-- HAMILTONIAN PRIME IDENTITY PIPELINE (v1.7)
-- Objective: 100% Unique Coverage (Strict 1km, Max 2 per landmark)

SET statement_timeout = '25min';
BEGIN;

-- 1. IDENTIFY REMAINING (orphans or partials)
-- We only update those that ARE NOT in hamilton_v1 yet or need better pairing.
-- Actually, we redo it but with a smarter selection.

-- 2. BULK INFERENCE (PRIME MODE)
WITH AllCandidatePairs AS (
  SELECT 
    o.id as office_id,
    l.id as landmark_id,
    l.name as landmark_name,
    ST_Distance(o.geom, l.centroid_geom::geography) as dist,
    degrees(ST_Azimuth(l.centroid_geom::geometry, o.geom::geometry)) as bearing
  FROM public.iebc_offices o
  JOIN LATERAL (
    SELECT id, name, centroid_geom
    FROM public.map_landmarks
    WHERE ST_DWithin(o.geom::geometry, centroid_geom, 0.01) -- STRICT 1KM
      AND (name NOT ILIKE '%' || o.clean_office_location || '%' AND o.clean_office_location NOT ILIKE '%' || name || '%')
    ORDER BY o.geom::geometry <-> centroid_geom
    LIMIT 20 -- Increase visibility to avoid collision blocking
  ) l ON TRUE
  WHERE o.latitude IS NOT NULL AND o.longitude IS NOT NULL
),
UsageStats AS (
    SELECT 
        office_id, landmark_id, landmark_name, dist, bearing,
        ROW_NUMBER() OVER (PARTITION BY landmark_id ORDER BY dist ASC) as usage_rank,
        ROW_NUMBER() OVER (PARTITION BY office_id ORDER BY dist ASC) as office_choice_rank
    FROM AllCandidatePairs
),
UniqueSelection AS (
    SELECT * FROM UsageStats
    WHERE usage_rank <= 2 -- Max 2 per landmark
      AND office_choice_rank = 1 -- Current best choice for office
)
UPDATE public.iebc_offices o
SET 
  direction_landmark = us.landmark_name,
  landmark = us.landmark_name,
  distance_from_landmark = us.dist,
  direction_type = CASE 
    WHEN us.bearing < 22.5 THEN 'N'
    WHEN us.bearing < 67.5 THEN 'NE'
    WHEN us.bearing < 112.5 THEN 'E'
    WHEN us.bearing < 157.5 THEN 'SE'
    WHEN us.bearing < 202.5 THEN 'S'
    WHEN us.bearing < 247.5 THEN 'SW'
    WHEN us.bearing < 292.5 THEN 'W'
    WHEN us.bearing < 337.5 THEN 'NW'
    ELSE 'N'
  END,
  office_location = CASE 
    WHEN us.dist > 150 THEN 
        o.clean_office_location || ', ' || ROUND(us.dist)::text || 'm ' || 
        (CASE 
            WHEN us.bearing < 22.5 THEN 'N'
            WHEN us.bearing < 67.5 THEN 'NE'
            WHEN us.bearing < 112.5 THEN 'E'
            WHEN us.bearing < 157.5 THEN 'SE'
            WHEN us.bearing < 202.5 THEN 'S'
            WHEN us.bearing < 247.5 THEN 'SW'
            WHEN us.bearing < 292.5 THEN 'W'
            WHEN us.bearing < 337.5 THEN 'NW'
            ELSE 'N'
        END) || ' of ' || us.landmark_name
    ELSE 
        o.clean_office_location || ', ' || 
        (CASE 
            WHEN us.dist < 5 THEN 'at'
            WHEN us.dist < 50 THEN 'opposite'
            WHEN us.dist < 120 THEN 'next to'
            ELSE 'near'
        END) || ' ' || us.landmark_name
  END,
  landmark_source = 'hamilton_v1',
  verified = true
FROM UniqueSelection us
WHERE o.id = us.office_id;

COMMIT;
