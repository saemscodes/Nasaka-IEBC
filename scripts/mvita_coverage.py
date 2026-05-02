import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def audit():
    db_url = "postgresql://postgres.ftswzvqwxdwgkvfbwfpx:1268Saem'sTunes!@aws-0-eu-north-1.pooler.supabase.com:6543/postgres"
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("\n--- MVITA COVERAGE AUDIT ---")
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE constituency_name = 'MVITA'")
    total = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE constituency_name = 'MVITA' AND landmark IS NOT NULL")
    identified = cur.fetchone()[0]
    
    print(f"Total Mvita Offices: {total}")
    print(f"Identified (Unique): {identified}")
    print(f"Coverage: {(identified/total*100):.2f}%")
    
    print("\n--- SAMPLE UNIQUE IDENTIFIERS (MVITA) ---")
    cur.execute("""
        SELECT id, office_location, direction_type, distance_from_landmark
        FROM public.iebc_offices 
        WHERE constituency_name = 'MVITA' AND landmark IS NOT NULL 
        LIMIT 10
    """)
    rows = cur.fetchall()
    for r in rows:
        print(f"ID: {r[0]} | Loc: {r[1]} | Dir: {r[2]} | Dist: {r[3]}m")
        
    conn.close()

if __name__ == "__main__":
    audit()
