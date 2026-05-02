import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def verify():
    db_url = "postgresql://postgres.ftswzvqwxdwgkvfbwfpx:1268Saem'sTunes!@aws-0-eu-north-1.pooler.supabase.com:6543/postgres"
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute("SELECT COUNT(*) FROM public.map_landmarks;")
    total = cur.fetchone()[0]
    print(f"Total Landmarks: {total}")
    
    cur.execute("SELECT COUNT(*) FROM public.map_landmarks WHERE centroid_geom IS NULL;")
    nulls = cur.fetchone()[0]
    print(f"Null Geoms: {nulls}")
    
    if total > 0:
        cur.execute("SELECT name, ST_AsText(centroid_geom) FROM public.map_landmarks WHERE centroid_geom IS NOT NULL LIMIT 1;")
        r = cur.fetchone()
        print(f"Sample: {r[0]} | {r[1]}")
        
    conn.close()

if __name__ == "__main__":
    verify()
