-- Fix the get_offices_in_bounds function to return correct data types
-- Column 15 is likely 'walking_effort' - convert from numeric to double precision

CREATE OR REPLACE FUNCTION get_offices_in_bounds(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
  zoom_level integer default 15
)
RETURNS TABLE (
  id integer,
  county text,
  constituency text,
  constituency_name text,
  office_location text,
  latitude double precision,
  longitude double precision,
  verified boolean,
  formatted_address text,
  landmark text,
  landmark_normalized text,
  landmark_source text,
  walking_effort double precision,  -- Fixed: changed from numeric to double precision
  elevation_meters double precision,
  geocode_verified boolean,
  geocode_verified_at timestamptz,
  multi_source_confidence double precision,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    id,
    county,
    constituency,
    constituency_name,
    office_location,
    latitude::double precision,
    longitude::double precision,
    verified,
    formatted_address,
    landmark,
    landmark_normalized,
    landmark_source,
    COALESCE(walking_effort::double precision, 1.0) as walking_effort,
    COALESCE(elevation_meters::double precision, 0.0) as elevation_meters,
    geocode_verified,
    geocode_verified_at,
    COALESCE(multi_source_confidence::double precision, 0.95) as multi_source_confidence,
    created_at,
    updated_at
  FROM iebc_offices
  WHERE latitude IS NOT NULL 
    AND longitude IS NOT NULL
    AND latitude >= min_lat 
    AND latitude <= max_lat 
    AND longitude >= min_lng 
    AND longitude <= max_lng
    AND verified = true
  ORDER BY 
    CASE 
      WHEN zoom_level >= 12 THEN constituency_name
      ELSE county
    END,
    office_location
  LIMIT CASE 
    WHEN zoom_level >= 12 THEN 1000
    WHEN zoom_level >= 10 THEN 500
    WHEN zoom_level >= 8 THEN 200
    ELSE 50
  END;
$$;

-- Grant execute permission to anon role
GRANT EXECUTE ON FUNCTION get_offices_in_bounds TO anon;
