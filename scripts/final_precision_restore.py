import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def final_precision_restore():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("--- STARTING FINAL PRECISION RESTORATION (HAM MODE) ---")
    
    # 1. Update from LEGACY (Priority 1)
    # Match by County + Constituency + Exact Name Match or Similarity
    # This restores the descriptive legacy identifers (e.g. "At Fort Jesus")
    print("Step 1: Legacy Descriptive Restoration...")
    cur.execute("""
        UPDATE public.iebc_offices of
        SET 
            office_location = legacy.office_location,
            landmark = legacy.landmark,
            clean_office_location = COALESCE(legacy.clean_office_location, legacy.office_location)
        FROM public.iebc_offices_legacy_backup legacy
        WHERE of.county = legacy.county
          AND (of.constituency_name = legacy.constituency_name OR of.constituency_name = legacy.constituency)
          AND (
            of.office_location = legacy.office_location 
            OR similarity(of.office_location, legacy.office_location) > 0.4
            OR of.office_location ILIKE '%%Thika Road%%' -- Catch the ones I polluted
          )
    """)
    print(f"Step 1 updated: {cur.rowcount} rows.")
    conn.commit()

    # 2. Constrained Spatial Enrichment (Priority 2)
    # Search for STRUCTURES in the SAME county only
    print("Step 2: Constrained Spatial Join (Structures-First, Same County)...")
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
                SELECT ml_sub.name, ml_sub.centroid_geom
                FROM public.map_landmarks ml_sub
                WHERE ml_sub.landmark_type != 'road'
                ORDER BY ml_sub.centroid_geom <-> of2.geom
                LIMIT 1
            ) ml2
            WHERE (of2.landmark IS NULL OR of2.landmark = '' OR of2.landmark = 'Thika Road')
              AND of2.geom IS NOT NULL
        ) ml
        WHERE of.id = ml.id
    """)
    print(f"Step 2 updated: {cur.rowcount} rows.")
    conn.commit()
    
    conn.close()

if __name__ == "__main__":
    final_precision_restore()
