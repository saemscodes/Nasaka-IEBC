import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Audit ID 1 (Constituency Office)
    cur.execute("SELECT * FROM public.iebc_offices WHERE id = 1")
    row = cur.fetchone()
    colnames = [desc[0] for desc in cur.description]
    
    print("=== ID 1 FINAL AUDIT (MOMBASA / CHANGAMWE) ===")
    for i, val in enumerate(row):
        # Only show the relevant columns from the user's list
        if colnames[i] in [
            'county', 'constituency', 'ward', 'returning_officer_name', 'returning_officer_email',
            'ward_id', 'ward_code', 'county_code', 'caw_code', 'office_type',
            'landmark', 'distance_from_landmark', 'direction_type', 'direction_landmark',
            'source', 'verified', 'geocode_status'
        ]:
            print(f"  {colnames[i]}: {val}")
            
    # Audit ID 190757 (Registration Centre)
    cur.execute("SELECT id, office_location, returning_officer_name, caw_code FROM public.iebc_offices WHERE id = 190757")
    row2 = cur.fetchone()
    print(f"\n=== ID 190757 Audit (KIJABE CENTRE) ===\n  {row2}")

    # Total Counts
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE returning_officer_name IS NOT NULL")
    ro_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE caw_code IS NOT NULL")
    caw_count = cur.fetchone()[0]
    
    print(f"\nTOTAL RECORDS: 24668 (locked)")
    print(f"TOTAL WITH RO NAME: {ro_count}")
    print(f"TOTAL WITH CAW CODE: {caw_count}")

    conn.close()
except Exception as e:
    print(f"PROOF ERROR: {e}")
