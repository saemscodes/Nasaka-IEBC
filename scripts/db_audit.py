import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def audit():
    db_url = os.getenv("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("\n--- TABLE AUDIT ---")
    cur.execute("SELECT COUNT(*) FROM public.map_landmarks;")
    print(f"Total Landmarks: {cur.fetchone()[0]}")
    
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE latitude IS NOT NULL;")
    print(f"Total Geocoded Offices: {cur.fetchone()[0]}")
    
    print("\n--- SAMPLE LANDMARK ---")
    cur.execute("SELECT name, landmark_type, ST_AsText(centroid_geom) FROM public.map_landmarks LIMIT 1;")
    r = cur.fetchone()
    print(f"Name: {r[0]} | Type: {r[1]} | Geom: {r[2]}")
    
    conn.close()

if __name__ == "__main__":
    audit()
