import json
import os
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()

DB_URL = "postgresql://postgres.ftswzvqwxdwgkvfbwfpx:1268Saem'sTunes!@aws-0-eu-north-1.pooler.supabase.com:6543/postgres"

def seed_v2():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    with open('data/moe_schools.json', 'r', encoding='utf-8') as f:
        schools = json.load(f)
        
    print(f"Loaded {len(schools)} schools.")
    
    data = []
    for s in schools:
        name = s.get('name')
        lat = s.get('lat')
        lon = s.get('lng')
        if name and lat and lon:
            # We use name + lat + lon to ensure uniqueness if name repeats
            data.append((name, 'school', lon, lat, 'moe', True))
            
    # Process in batches of 1000
    batch_size = 1000
    for i in range(0, len(data), batch_size):
        batch = data[i:i+batch_size]
        try:
            execute_values(cur, """
                INSERT INTO public.map_landmarks (name, landmark_type, centroid_geom, source, verified)
                VALUES %s
                ON CONFLICT DO NOTHING;
            """, [ (r[0], r[1], f"SRID=4326;POINT({r[2]} {r[3]})", r[4], r[5]) for r in batch ])
            conn.commit()
            print(f"  Inserted batch {i//batch_size + 1}")
        except Exception as e:
            print(f"  Error in batch {i//batch_size + 1}: {e}")
            conn.rollback()
            
    conn.close()

if __name__ == "__main__":
    seed_v2()
