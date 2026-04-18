import os, psycopg2
from dotenv import load_dotenv

def final_audit():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("\n=== FINAL RELATIONAL AUDIT ===")
    
    # 1. Ward Coverage
    cur.execute("SELECT COUNT(DISTINCT ward_code) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' AND ward_code IS NOT NULL")
    wards = cur.fetchone()[0]
    
    # 2. Geocoding coverage on the "Suriving" original records
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE source != 'NASAKA Recovery Import' AND latitude IS NOT NULL")
    original_geo = cur.fetchone()[0]
    
    # 3. Check for specific codes to see if double-streams exist
    cur.execute("""
        SELECT office_location, COUNT(*) 
        FROM public.iebc_offices 
        WHERE office_type = 'REGISTRATION_CENTRE' 
        GROUP BY office_location, ward_code 
        HAVING COUNT(*) > 1 
        LIMIT 5
    """)
    streams = cur.fetchall()
    
    print(f"Total Unique Wards:      {wards}")
    print(f"Original Geocoded Kept: {original_geo}")
    print(f"Streams Detected (Multi-centre per location): {len(streams) > 0}")
    if streams:
        for s in streams:
            print(f"  - {s[0]} (Ward: {s[1]}): {s[1]} centres")

    conn.close()

if __name__ == "__main__": final_audit()
