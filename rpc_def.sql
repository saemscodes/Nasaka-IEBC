CREATE OR REPLACE FUNCTION public.get_offices_in_bounds(min_lat double precision, min_lng double precision, max_lat double precision, max_lng double precision, zoom_level double precision DEFAULT 15)
 RETURNS TABLE(id bigint, county text, constituency_name text, office_location text, latitude double precision, longitude double precision, verified boolean, type text, office_type text, landmark text, distance_from_landmark double precision, formatted_address text, ward text, category text, elevation_meters double precision, walking_effort text, landmark_normalized text, landmark_source text, isochrone_15min jsonb, isochrone_30min jsonb, isochrone_45min jsonb, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    o.id::bigint,
    o.county,
    o.constituency_name,
    o.office_location,
    o.latitude::double precision,
    o.longitude::double precision,
    o.verified,
    'office'::text as type,
    o.office_type,
    o.landmark,
    COALESCE(o.distance_from_landmark::double precision, 0.0),
    o.formatted_address,
    o.ward,
    o.category,
    COALESCE(o.elevation_meters::double precision, 0.0),
    o.walking_effort::text, -- FIXED: Return raw text to avoid double precision cast error on 'moderate'
    o.landmark_normalized,
    o.landmark_source,
    o.isochrone_15min,
    o.isochrone_30min,
    o.isochrone_45min,
    o.created_at,
    o.updated_at
  FROM iebc_offices o
  WHERE o.latitude IS NOT NULL 
    AND o.longitude IS NOT NULL
    AND o.latitude >= min_lat 
    AND o.latitude <= max_lat 
    AND o.longitude >= min_lng 
    AND o.longitude <= max_lng
    AND o.verified = true
    AND (
      (zoom_level >= 12) OR (o.office_type IN ('CONSTITUENCY_OFFICE', 'COUNTY_OFFICE'))
    )
  ORDER BY 
    CASE 
      WHEN zoom_level >= 12 THEN o.constituency_name
      ELSE o.county
    END,
    o.office_location
  LIMIT CASE 
    WHEN zoom_level >= 12 THEN 1000
    WHEN zoom_level >= 10 THEN 500
    WHEN zoom_level >= 8 THEN 200
    ELSE 50
  END;
END;
$function$
