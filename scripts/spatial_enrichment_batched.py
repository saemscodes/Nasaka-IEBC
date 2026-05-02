import psycopg2
import os
from tqdm import tqdm
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def batched_spatial_enrichment():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Get IDs of orphans
    cur.execute("SELECT id FROM public.iebc_offices WHERE (landmark IS NULL OR landmark = '') AND geom IS NOT NULL")
    ids = [r[0] for r in cur.fetchall()]
    print(f"Total orphans to enrich: {len(ids)}")
    
    for oid in tqdm(ids, desc="Enriching"):
        cur.execute("""
            WITH nearest AS (
                SELECT name, landmark_type, ST_Distance(of.geom, ml.centroid_geom) * 111139 as dist
                FROM public.iebc_offices of
                CROSS JOIN LATERAL (
                    SELECT name, landmark_type, centroid_geom
                    FROM public.map_landmarks
                    ORDER BY centroid_geom <-> of.geom
                    LIMIT 1
                ) ml
                WHERE of.id = %s
            )
            UPDATE public.iebc_offices
            SET 
                landmark = n.name,
                office_location = CASE 
                    WHEN n.dist < 50 THEN 'At ' || n.name
                    WHEN n.dist < 200 THEN 'Near ' || n.name
                    ELSE 'Near ' || n.name || ' (' || ROUND(n.dist::numeric, 0) || 'm)'
                END,
                direction_distance = n.dist
            FROM nearest n
            WHERE public.iebc_offices.id = %s
        """, (oid, oid))
        conn.commit()
    
    conn.close()

if __name__ == "__main__":
    batched_spatial_enrichment()
