import psycopg2
import os
import time
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def county_precision_sync():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Get all counties
    cur.execute("SELECT DISTINCT county FROM public.iebc_offices ORDER BY county")
    counties = [r[0] for r in cur.fetchall()]
    
    print(f"--- STARTING COUNTY PRECISION SYNC (47 COUNTIES) ---")
    
    for county in counties:
        print(f"Syncing {county}...")
        try:
            # 1. Legacy Restore for this county
            cur.execute("""
                UPDATE public.iebc_offices of
                SET 
                    office_location = legacy.office_location,
                    landmark = legacy.landmark,
                    clean_office_location = COALESCE(legacy.clean_office_location, legacy.office_location)
                FROM public.iebc_offices_legacy_backup legacy
                WHERE of.county = %s AND legacy.county = %s
                  AND (of.constituency_name = legacy.constituency_name OR of.constituency_name = legacy.constituency)
                  AND (
                    of.office_location = legacy.office_location 
                    OR similarity(of.office_location, legacy.office_location) > 0.3
                    OR of.landmark = 'Thika Road'
                  )
            """, (county, county))
            legacy_count = cur.rowcount
            
            # 2. Spatial Enrichment for orphans in this county
            cur.execute("""
                UPDATE public.iebc_offices of
                SET 
                  landmark = ml.name,
                  office_location = 'Near ' || ml.name
                FROM (
                  SELECT DISTINCT ON (of2.id)
                    of2.id,
                    ml2.name
                  FROM public.iebc_offices of2
                  CROSS JOIN LATERAL (
                    SELECT name
                    FROM public.map_landmarks ml2
                    WHERE ml2.landmark_type != 'road'
                    ORDER BY ml2.centroid_geom <-> of2.geom
                    LIMIT 1
                  ) ml2
                  WHERE of2.county = %s
                    AND (of2.landmark IS NULL OR of2.landmark = '' OR of2.landmark = 'Thika Road')
                    AND of2.geom IS NOT NULL
                ) ml
                WHERE of.id = ml.id
            """, (county,))
            spatial_count = cur.rowcount
            
            conn.commit()
            print(f"  {county}: Legacy={legacy_count}, Spatial={spatial_count}")
        except Exception as e:
            conn.rollback()
            print(f"  {county}: FAILED - {e}")
            
    conn.close()

if __name__ == "__main__":
    county_precision_sync()
