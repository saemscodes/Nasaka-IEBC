import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("[SYNC] Synchronizing RO metadata from raw centres table...")
    
    # Update iebc_offices JOINING with raw registration centres
    # This is the most accurate way as it uses her raw resource table directly
    cur.execute("""
        UPDATE public.iebc_offices AS t
        SET 
            returning_officer_name = r.returning_officer_name,
            returning_officer_email = r.returning_officer_email,
            updated_at = NOW()
        FROM public.iebc_registration_centres AS r
        WHERE (
            -- Match by centre_code if available
            (t.centre_code IS NOT NULL AND t.centre_code = r.centre_code)
            OR
            -- Or match by name + constituency + county (fuzzy/lowercase)
            (LOWER(TRIM(t.office_location)) = LOWER(TRIM(r.name)) AND LOWER(TRIM(t.constituency)) = LOWER(TRIM(r.constituency)))
        )
        AND t.returning_officer_name IS NULL
        AND r.returning_officer_name IS NOT NULL
    """)
    print(f"  ✓ Restored ROI for {cur.rowcount} centres from raw source.")

    # Second Pass: Constituency Inheritance for Offices (IDs 1-290)
    cur.execute("""
        UPDATE public.iebc_offices AS target
        SET 
            returning_officer_name = source.ro_name,
            returning_officer_email = source.ro_email
        FROM (
            SELECT DISTINCT ON (constituency) constituency, returning_officer_name as ro_name, returning_officer_email as ro_email
            FROM public.iebc_offices
            WHERE office_type = 'REGISTRATION_CENTRE'
              AND returning_officer_name IS NOT NULL
        ) AS source
        WHERE target.office_type = 'CONSTITUENCY_OFFICE'
          AND target.constituency = source.constituency
          AND target.returning_officer_name IS NULL
    """)
    print(f"  ✓ Finalized Hierarchy Inheritance for {cur.rowcount} offices.")

    # Final Audit
    cur.execute("SELECT id, office_location, returning_officer_name FROM public.iebc_offices WHERE id = 8")
    row8 = cur.fetchone()
    print(f"\nID 8 PROOF: {row8}")
    
    cur.execute("SELECT id, office_location, returning_officer_name FROM public.iebc_offices WHERE id = 1")
    row1 = cur.fetchone()
    print(f"ID 1 PROOF: {row1}")

    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE returning_officer_name IS NULL")
    rem = cur.fetchone()[0]
    print(f"REMAINING NULLS TABLE-WIDE: {rem}")

    conn.close()
except Exception as e:
    print(f"SYNC ERROR: {e}")
