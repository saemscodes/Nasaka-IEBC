import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def spatial_debug():
    db_url = "postgresql://postgres.ftswzvqwxdwgkvfbwfpx:1268Saem'sTunes!@aws-0-eu-north-1.pooler.supabase.com:6543/postgres"
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("--- SPATIAL DEBUG: ID 207247 (Mvita) ---")
    cur.execute("SELECT ST_AsText(geom::geometry) FROM public.iebc_offices WHERE id = 207247;")
    o_geom = cur.fetchone()[0]
    print(f"Office Geom: {o_geom}")
    
    print("\n--- NEAREST LANDMARKS (NO TYPE FILTER) ---")
    cur.execute("""
        SELECT name, landmark_type, ST_AsText(centroid_geom), ST_Distance(ST_GeomFromText(%s, 4326), centroid_geom) as dist
        FROM public.map_landmarks
        ORDER BY centroid_geom <-> ST_GeomFromText(%s, 4326)
        LIMIT 5;
    """, (o_geom, o_geom))
    rows = cur.fetchall()
    for r in rows:
        print(f"Name: {r[0]} | Type: {r[1]} | Geom: {r[2]} | Dist: {r[3]}")
        
    print("\n--- NEAREST LANDMARKS (WITH 'school' FILTER) ---")
    cur.execute("""
        SELECT name, landmark_type, ST_AsText(centroid_geom), ST_Distance(ST_GeomFromText(%s, 4326), centroid_geom) as dist
        FROM public.map_landmarks
        WHERE landmark_type = 'school'
        ORDER BY centroid_geom <-> ST_GeomFromText(%s, 4326)
        LIMIT 5;
    """, (o_geom, o_geom))
    rows = cur.fetchall()
    for r in rows:
        print(f"Name: {r[0]} | Type: {r[1]} | Geom: {r[2]} | Dist: {r[3]}")

    conn.close()

if __name__ == "__main__":
    spatial_debug()
