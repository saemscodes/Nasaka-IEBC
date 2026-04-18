import os, psycopg2
from dotenv import load_dotenv

def verify():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("\n=== DETAILED STATUS AUDIT ===")
    
    # 1. Geocode Status Breakdown
    cur.execute("SELECT geocode_status, COUNT(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' GROUP BY geocode_status")
    print("\nGeocode Status:")
    for r in cur.fetchall():
        print(f"  {r[0]}: {r[1]}")
    
    # 2. Source Breakdown
    cur.execute("SELECT source, COUNT(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' GROUP BY source")
    print("\nSource:")
    for r in cur.fetchall():
        print(f"  {r[0]}: {r[1]}")

    # 3. Coordinate Check (Non-zero, non-null)
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' AND latitude IS NOT NULL AND latitude != 0 AND latitude != -1.2884")
    print(f"\nNon-Centroid Coords: {cur.fetchone()[0]}")
    
    conn.close()

if __name__ == "__main__": verify()
