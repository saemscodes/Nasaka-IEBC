import psycopg2
import os
from tqdm import tqdm
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def surgical_spatial_enrichment():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Get IDs of orphans
    cur.execute("SELECT id FROM public.iebc_offices WHERE (landmark IS NULL OR landmark = '') AND geom IS NOT NULL")
    ids = [r[0] for r in cur.fetchall()]
    print(f"Total orphans to enrich: {len(ids)}")
    
    for oid in tqdm(ids, desc="Enriching"):
        try:
            cur.execute("""
                UPDATE public.iebc_offices
                SET 
                    landmark = (
                        SELECT name FROM public.map_landmarks 
                        ORDER BY centroid_geom <-> iebc_offices.geom 
                        LIMIT 1
                    ),
                    office_location = (
                        SELECT 'Near ' || name FROM public.map_landmarks 
                        ORDER BY centroid_geom <-> iebc_offices.geom 
                        LIMIT 1
                    )
                WHERE id = %s
            """, (oid,))
            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"Failed for {oid}: {e}")
    
    conn.close()

if __name__ == "__main__":
    surgical_spatial_enrichment()
