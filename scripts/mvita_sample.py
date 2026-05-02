import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def get_sample():
    db_url = "postgresql://postgres.ftswzvqwxdwgkvfbwfpx:1268Saem'sTunes!@aws-0-eu-north-1.pooler.supabase.com:6543/postgres"
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id, office_location, landmark, direction_type, distance_from_landmark
        FROM public.iebc_offices 
        WHERE constituency_name = 'MVITA' AND landmark IS NOT NULL 
        LIMIT 10
    """)
    rows = cur.fetchall()
    
    print("| ID | office_location | landmark | direction | distance |")
    print("|----|-----------------|----------|-----------|----------|")
    for r in rows:
        print(f"| {r[0]} | {r[1]} | {r[2]} | {r[3]} | {int(r[4])}m |")
        
    conn.close()

if __name__ == "__main__":
    get_sample()
