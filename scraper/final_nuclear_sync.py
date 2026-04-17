import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("[NUCLEAR-SYNC] Filling final 555 gaps...")
    
    # Force fix for Lunga Lunga (ID 8) just in case
    cur.execute("""
        UPDATE public.iebc_offices 
        SET returning_officer_name = 'MWARUA CHIKOPHE ABDALLAH', 
            returning_officer_email = 'mabdallah@iebc.or.ke'
        WHERE (constituency ILIKE '%LUNGA%')
          AND returning_officer_name IS NULL
    """)
    print(f"  ✓ Processed Lunga Lunga variants: {cur.rowcount} updated.")

    # Global Constituency Inheritance for all NULLs
    cur.execute("""
        UPDATE public.iebc_offices AS target
        SET 
            returning_officer_name = source.ro_name,
            returning_officer_email = source.ro_email,
            updated_at = NOW()
        FROM (
            SELECT DISTINCT ON (constituency) 
                constituency, 
                returning_officer_name as ro_name, 
                returning_officer_email as ro_email
            FROM public.iebc_offices
            WHERE returning_officer_name IS NOT NULL
        ) AS source
        WHERE target.constituency = source.constituency
          AND target.returning_officer_name IS NULL
    """)
    print(f"  ✓ Inherited ROI for {cur.rowcount} remaining gaps.")
    
    # Final Verification
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE returning_officer_name IS NULL")
    rem = cur.fetchone()[0]
    print(f"FINAL NULL COUNT: {rem}")
    
    # Audit ID 8
    cur.execute("SELECT id, office_location, returning_officer_name FROM public.iebc_offices WHERE id = 8")
    print(f"ID 8 STATUS: {cur.fetchone()}")

    conn.close()
except Exception as e:
    print(f"NUCLEAR SYNC ERROR: {e}")
