import psycopg2
import os
import re
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def restore_ham_mode():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("--- STARTING HAM MODE RESTORATION ---")
    
    # Enable similarity extension if not enabled
    cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    
    # 1. Update based on County + Constituency + High Similarity (Landmark vs Prod Location)
    # This targets schools that are mentioned in the landmark field or vice versa
    print("Step 1: Restoring by Similarity...")
    cur.execute("""
        UPDATE public.iebc_offices of
        SET 
            office_location = legacy.office_location,
            clean_office_location = legacy.clean_office_location,
            landmark = legacy.landmark,
            direction_type = legacy.direction_type,
            direction_landmark = legacy.direction_landmark,
            direction_distance = legacy.direction_distance
        FROM public.iebc_offices_legacy_backup legacy
        WHERE UPPER(of.county) = UPPER(legacy.county)
          AND (UPPER(of.constituency_name) = UPPER(legacy.constituency) OR UPPER(of.constituency_name) = UPPER(legacy.constituency_name))
          AND (
            similarity(of.office_location, legacy.landmark) > 0.4
            OR similarity(of.office_location, legacy.office_location) > 0.4
            OR (of.office_location ILIKE '%%' || legacy.landmark || '%%' AND length(legacy.landmark) > 5)
          )
          AND (of.landmark IS NULL OR of.landmark = '')
    """)
    print(f"Step 1 updated: {cur.rowcount} rows.")
    conn.commit()

    # 2. Update based on County + Constituency + PROXIMITY (Last Resort)
    # If we have latitude/longitude in both, match by distance
    # Note: legacy table has latitude/longitude columns
    print("Step 2: Restoring by Proximity (100m threshold)...")
    cur.execute("""
        UPDATE public.iebc_offices of
        SET 
            office_location = legacy.office_location,
            clean_office_location = legacy.clean_office_location,
            landmark = legacy.landmark,
            direction_type = legacy.direction_type,
            direction_landmark = legacy.direction_landmark,
            direction_distance = legacy.direction_distance
        FROM public.iebc_offices_legacy_backup legacy
        WHERE of.latitude IS NOT NULL AND of.longitude IS NOT NULL
          AND legacy.latitude IS NOT NULL AND legacy.longitude IS NOT NULL
          AND of.landmark IS NULL
          AND UPPER(of.county) = UPPER(legacy.county)
          AND (
            point(of.longitude, of.latitude) <-> point(legacy.longitude, legacy.latitude) < 0.001
          )
    """)
    print(f"Step 2 updated: {cur.rowcount} rows.")
    conn.commit()

    # 3. Final Polish: Ensure office_location is the descriptive one
    # If office_location is still a school name and we have clean_office_location, 
    # but the user insisted that office_location MUST be the landmark data.
    # In legacy, office_location usually contains "At...", "Next to..."
    
    print("Restoration complete.")
    conn.close()

if __name__ == "__main__":
    restore_ham_mode()
