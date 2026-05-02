import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def diagnose():
    db_url = "postgresql://postgres.ftswzvqwxdwgkvfbwfpx:1268Saem'sTunes!@aws-0-eu-north-1.pooler.supabase.com:6543/postgres"
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # ID in Mvita
    office_id = 207230
    print(f"\n--- DIAGNOSING OFFICE {office_id} ---")
    
    cur.execute("""
        SELECT o2.id, ST_AsText(o2.geom::geometry) as geom_o, l2.name, 
               ST_Distance(o2.geom::geometry, l2.centroid_geom) as deg_dist,
               ST_Distance(o2.geom, l2.centroid_geom::geography) as m_dist
        FROM public.iebc_offices o2
        CROSS JOIN LATERAL (
          SELECT name, centroid_geom
          FROM public.map_landmarks
          WHERE landmark_type = 'school'
          ORDER BY o2.geom::geometry <-> centroid_geom
          LIMIT 1
        ) l2
        WHERE o2.id = %s;
    """, (office_id,))
    
    r = cur.fetchone()
    if r:
        print(f"Office: {r[1]}")
        print(f"Nearest Land: {r[2]}")
        print(f"Deg Dist: {r[3]}")
        print(f"Metric Dist: {r[4]}m")
    else:
        print("No matches found in Lateral Join.")
        
    conn.close()

if __name__ == "__main__":
    diagnose()
