import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def probe():
    db_url = os.getenv("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # ID 207247 is in Kizingo
    print("\n--- PROBING LANDMARKS NEAR ID 207247 ---")
    cur.execute("""
        SELECT name, landmark_type, landmark_subtype, ST_Distance(ST_SetSRID(ST_Point(39.6761, -4.0664), 4326)::geography, centroid_geom::geography) as dist
        FROM public.map_landmarks
        WHERE ST_DWithin(ST_SetSRID(ST_Point(39.6761, -4.0664), 4326)::geography, centroid_geom::geography, 2000)
        ORDER BY dist ASC
        LIMIT 10;
    """)
    rows = cur.fetchall()
    for r in rows:
        print(f"Name: {r[0]} | Type: {r[1]} | Sub: {r[2]} | Dist: {r[3]}m")
    
    conn.close()

if __name__ == "__main__":
    probe()
