-- HAMILTONIAN HIGH-FIDELITY IDENTITY PIPELINE (v1.3 - RECURSIVE)
-- Objective: 100% Descriptive Coverage with Recursive Office Landmarking

SET statement_timeout = '15min';
BEGIN;

-- 2. BULK INFERENCE (RECURSIVE MODE)
-- Radius increased to 2km (0.02)
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
    WHEN l.dist > 150 THEN 
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
            WHEN l.dist < 120 THEN 'next to'
            ELSE 'near'
        END) || ' ' || l.name
  END,
  landmark_source = 'hamilton_v1',
  verified = true
FROM (
  SELECT DISTINCT ON (o2.id)
    o2.id,
    l2.name,
    ST_Distance(o2.geom, l2.centroid_geom::geography) as dist,
    degrees(ST_Azimuth(l2.centroid_geom::geometry, o2.geom::geometry)) as bearing
  FROM public.iebc_offices o2
  CROSS JOIN LATERAL (
    SELECT name, centroid_geom
    FROM public.map_landmarks
    -- IGNORE SELF and redundancy
    WHERE (name NOT ILIKE '%' || o2.clean_office_location || '%' AND o2.clean_office_location NOT ILIKE '%' || name || '%')
      AND ST_Distance(o2.geom::geometry, centroid_geom) > 0.0001
      AND ST_DWithin(o2.geom::geometry, centroid_geom, 0.02) -- STRICT 2KM RADIUS
    ORDER BY o2.geom::geometry <-> centroid_geom
    LIMIT 1
  ) l2
  WHERE (o2.landmark_source IS NULL OR o2.landmark_source NOT IN ('hamilton_v1'))
    AND o2.latitude IS NOT NULL AND o2.longitude IS NOT NULL
) l
WHERE o.id = l.id;

COMMIT;
