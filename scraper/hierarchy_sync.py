import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("[HIERARCHY] Executing SQL Inheritance pass (Sanitized)...")
    
    # Update Constituency Offices by inheriting from their child Registration Centres
    cur.execute("""
        UPDATE public.iebc_offices AS target
        SET 
            returning_officer_name = source.returning_officer_name,
            returning_officer_email = source.returning_officer_email,
            updated_at = NOW()
        FROM (
            SELECT DISTINCT ON (constituency) constituency, returning_officer_name, returning_officer_email
            FROM public.iebc_offices
            WHERE office_type = 'REGISTRATION_CENTRE'
              AND returning_officer_name IS NOT NULL
        ) AS source
        WHERE target.office_type = 'CONSTITUENCY_OFFICE'
          AND target.constituency = source.constituency
          AND target.returning_officer_name IS NULL
    """)
    
    count = cur.rowcount
    print(f"[OK] Inherited ROI for {count} constituency offices.")
    
    # Final check for ID 1
    cur.execute("SELECT id, office_location, returning_officer_name FROM public.iebc_offices WHERE id = 1")
    row = cur.fetchone()
    print(f"ID 1 FINAL STATUS: {row}")
    
    conn.close()
except Exception as e:
    print(f"HIERARCHY SYNC ERROR: {str(e)}")
