import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def spatial_enrichment():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("--- STARTING SPATIAL ENRICHMENT PASS ---")
    
    # Update orphans using nearest landmark from map_landmarks
    # Using <-> operator for KNN on geometry (PostGIS)
    cur.execute("""
        WITH nearest_landmarks AS (
            SELECT 
                of.id as office_id,
                ml.name as landmark_name,
                ml.landmark_type as l_type,
                ST_Distance(of.geom, ml.centroid_geom) * 111139 as distance_meters -- approx meters
            FROM public.iebc_offices of
            CROSS JOIN LATERAL (
                SELECT name, landmark_type, centroid_geom
                FROM public.map_landmarks
                ORDER BY centroid_geom <-> of.geom
                LIMIT 1
            ) ml
            WHERE (of.landmark IS NULL OR of.landmark = '') 
              AND of.geom IS NOT NULL
              AND ST_Distance(of.geom, ml.centroid_geom) < 0.01 -- Within ~1km
        )
        UPDATE public.iebc_offices of
        SET 
            landmark = nl.landmark_name,
            clean_office_location = of.office_location, -- Preserve the old name here as fallback
            office_location = CASE 
                WHEN nl.distance_meters < 50 THEN 'At ' || nl.landmark_name
                WHEN nl.distance_meters < 200 THEN 'Near ' || nl.landmark_name
                ELSE 'Opposite ' || nl.landmark_name
            END,
            direction_distance = nl.distance_meters
        FROM nearest_landmarks nl
        WHERE of.id = nl.office_id
    """)
    
    print(f"Spatial enrichment updated: {cur.rowcount} rows.")
    conn.commit()
    conn.close()

if __name__ == "__main__":
    spatial_enrichment()
