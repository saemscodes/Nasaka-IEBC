import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def audit():
    db_url = os.getenv("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("\n--- MVITA HIGH-FIDELITY AUDIT ---")
    cur.execute("SELECT id, office_location, landmark, distance_from_landmark, direction_type, landmark_source FROM public.iebc_offices WHERE constituency_name = 'MVITA' LIMIT 12")
    rows = cur.fetchall()
    for r in rows:
        print(f"ID: {r[0]} | Loc: {r[1]} | Mark: {r[2]} | Dist: {r[3]} | Source: {r[5]}")
        
    print("\n--- BARINGO PURGE AUDIT ---")
    cur.execute("SELECT id, county, office_location, landmark FROM public.iebc_offices WHERE landmark IN ('Westgate Shopping Mall', 'Thika Road') AND county != 'NAIROBI' LIMIT 5")
    rows = cur.fetchall()
    if not rows:
        print("  CLEAN: No Nairobi landmarks found in foreign counties.")
    else:
        for r in rows:
            print(f"  DIRTY: ID {r[0]} in {r[1]} has landmark {r[3]}")
    
    conn.close()

if __name__ == "__main__":
    audit()
