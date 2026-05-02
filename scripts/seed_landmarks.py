import json
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def seed_landmarks():
    db_url = os.getenv("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    with open('data/moe_schools.json', 'r', encoding='utf-8') as f:
        schools = json.load(f)
        
    print(f"Loaded {len(schools)} schools.")
    
    # We only seed schools that have coordinates
    count = 0
    for s in schools:
        name = s.get('name')
        lat = s.get('latitude')
        lon = s.get('longitude')
        county = s.get('county', '').upper()
        
        if name and lat and lon:
            try:
                cur.execute("""
                    INSERT INTO public.map_landmarks (name, landmark_type, centroid_geom, source, verified)
                    VALUES (%s, 'school', ST_SetSRID(ST_Point(%s, %s), 4326)::geometry, 'moe', true)
                    ON CONFLICT (name) DO NOTHING;
                """, (name, lon, lat))
                count += cur.rowcount
            except Exception as e:
                cur.connection.rollback()
                continue
                
    conn.commit()
    print(f"Seeded {count} landmarks into map_landmarks.")
    conn.close()

if __name__ == "__main__":
    seed_landmarks()
