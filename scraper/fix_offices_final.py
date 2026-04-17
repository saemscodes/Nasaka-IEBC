import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("[FINAL-FIX] Propagating ROI from Centres to Offices...")
    
    # Update all 290 constituency offices in one go via a JOIN
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
            WHERE office_type = 'REGISTRATION_CENTRE'
              AND returning_officer_name IS NOT NULL
        ) AS source
        WHERE target.office_type = 'CONSTITUENCY_OFFICE'
          AND target.constituency = source.constituency
    """)
    
    print(f"  ✓ Inherited ROI for {cur.rowcount} offices.")
    
    # Audit ID 8 specifically
    cur.execute("SELECT id, office_location, returning_officer_name, returning_officer_email FROM public.iebc_offices WHERE id = 8")
    row = cur.fetchone()
    print(f"ID 8 FINAL STATE: {row}")
    
    # Audit ID 1 specifically
    cur.execute("SELECT id, office_location, returning_officer_name, returning_officer_email FROM public.iebc_offices WHERE id = 1")
    row1 = cur.fetchone()
    print(f"ID 1 FINAL STATE: {row1}")

    conn.close()
except Exception as e:
    print(f"FINAL FIX ERROR: {e}")
