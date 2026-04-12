import psycopg2
from dotenv import load_dotenv

load_dotenv()

password = "1268Saem'sTunes!"
project_id = "ftswzvqwxdwgkvfbwfpx"

configs = [
    {"host": "aws-0-eu-north-1.pooler.supabase.com", "port": 6543, "user": f"postgres.{project_id}", "dbname": "postgres"}
]

sql = """
-- AGGRESSIVE CLEANUP: Drop all possible variants of get_offices_in_bounds
-- This is necessary to resolve PGRST203 (ambiguous function candidate)

DO $$ 
BEGIN
    -- Drop by names and all possible argument patterns
    DROP FUNCTION IF EXISTS public.get_offices_in_bounds(float8, float8, float8, float8, float8);
    DROP FUNCTION IF EXISTS public.get_offices_in_bounds(float8, float8, float8, float8, int4);
    DROP FUNCTION IF EXISTS public.get_offices_in_bounds(numeric, numeric, numeric, numeric, numeric);
    DROP FUNCTION IF EXISTS public.get_offices_in_bounds(numeric, numeric, numeric, numeric, int);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Function drop failed: %', SQLERRM;
END $$;

-- Drop specifically by what the error message reported
DROP FUNCTION IF EXISTS public.get_offices_in_bounds(double precision, double precision, double precision, double precision, double precision);
DROP FUNCTION IF EXISTS public.get_offices_in_bounds(double precision, double precision, double precision, double precision, integer);

-- Now RECREATE with the definitive signature (all float8/double precision)
CREATE OR REPLACE FUNCTION public.get_offices_in_bounds(
  min_lat float8,
  min_lng float8,
  max_lat float8,
  max_lng float8,
  zoom_level float8 DEFAULT 15
)
RETURNS TABLE (
  id bigint,
  county text,
  constituency_name text,
  office_location text,
  latitude float8,
  longitude float8,
  verified boolean,
  type text,
  office_type text,
  landmark text,
  distance_from_landmark float8,
  formatted_address text,
  ward text,
  category text,
  elevation_meters float8,
  walking_effort text,
  landmark_normalized text,
  landmark_source text,
  isochrone_15min text,
  isochrone_30min text,
  isochrone_45min text
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.county,
    o.constituency_name,
    o.office_location,
    o.latitude,
    o.longitude,
    o.verified,
    'office'::text as type,
    o.office_type,
    o.landmark,
    o.distance_from_landmark,
    o.formatted_address,
    o.ward,
    o.category,
    o.elevation_meters,
    o.walking_effort,
    o.landmark_normalized,
    o.landmark_source,
    o.isochrone_15min,
    o.isochrone_30min,
    o.isochrone_45min
  FROM public.iebc_offices o
  WHERE o.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  AND (
    -- TIERED VISIBILITY logic
    (zoom_level >= 12) OR (o.office_type IN ('CONSTITUENCY_OFFICE', 'COUNTY_OFFICE'))
  )
  LIMIT 5000;
END;
$$;
"""

for config in configs:
    print(f"Connecting to {config['host']}...")
    try:
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            user=config['user'],
            password=password,
            dbname=config['dbname'],
            sslmode='require'
        )
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(sql)
        print("SUCCESS: Unified RPC deployed.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"FAILED: {e}")
