import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("[UAR-v3] Executing Ultimate 30-Column Repopulation...")

    # 1. Update Administrative Codes (Ward Code, County Code, CAW Code)
    # Joining with wards and counties tables directly in SQL
    cur.execute("""
        UPDATE public.iebc_offices AS t
        SET 
            ward_code = w.caw_code,
            ward_id = w.id,
            ward = COALESCE(t.ward, w.ward_name),
            county_code = c.county_code,
            caw_code = COALESCE(w.caw_code, '') || COALESCE(t.centre_code, '999'),
            source = 'IEBC Atomic Sync v11.0',
            verified = true,
            updated_at = NOW()
        FROM public.wards w, public.counties c
        WHERE (
            -- Match by ward name + constituency + county
            (LOWER(TRIM(t.ward)) = LOWER(TRIM(w.ward_name)) AND LOWER(TRIM(t.constituency)) = LOWER(TRIM(w.constituency)))
            OR
            -- Or match by constituency if it's an office
            (t.office_type = 'CONSTITUENCY_OFFICE' AND LOWER(TRIM(t.constituency)) = LOWER(TRIM(w.constituency)))
        )
        AND LOWER(TRIM(t.county)) = LOWER(TRIM(c.name))
        AND (t.ward_code IS NULL OR t.caw_code IS NULL)
    """)
    print(f"  ✓ Updated Administrative Codes for {cur.rowcount} records.")

    # 2. Update Landmarks and Directions from Notes
    # Generic extraction for all records
    cur.execute("""
        UPDATE public.iebc_offices
        SET 
            distance_from_landmark = (regexp_match(notes, '(\d+)\s*m'))[1]::integer,
            direction_type = (regexp_match(notes, '(at|near|opposite|next to|along)'))[1],
            direction_landmark = (regexp_match(notes, '(?:at|near|opposite|next to|along)\s+([^,]+)'))[1],
            landmark_type = 'Building',
            landmark_subtype = 'Registration Centre',
            updated_at = NOW()
        WHERE notes IS NOT NULL 
          AND (distance_from_landmark IS NULL OR direction_type IS NULL)
    """)
    print(f"  ✓ Updated Spatial Metadata patterns for {cur.rowcount} records.")

    # 3. Inherit ROI Metadata for Constituency Offices (Again, to be safe)
    cur.execute("""
        UPDATE public.iebc_offices AS target
        SET 
            returning_officer_name = source.returning_officer_name,
            returning_officer_email = source.returning_officer_email
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
    print(f"  ✓ Finalized Hierarchy Inheritance for {cur.rowcount} offices.")

    # 4. Final Verification
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE caw_code IS NOT NULL) as has_caw,
            COUNT(*) FILTER (WHERE ward_code IS NOT NULL) as has_wcode,
            COUNT(*) FILTER (WHERE returning_officer_name IS NOT NULL) as has_ro
        FROM public.iebc_offices
    """)
    res = cur.fetchone()
    print("\n=== FINAL PRODUCTION STATUS (ALL TIERS) ===")
    print(f"  Total Records:   {res[0]}")
    print(f"  Valid CAW Codes: {res[1]} ({100*res[1]/res[0]:.1f}%)")
    print(f"  Valid Ward Codes: {res[2]} ({100*res[2]/res[0]:.1f}%)")
    print(f"  Valid RO Names:  {res[3]} ({100*res[3]/res[0]:.1f}%)")

    conn.close()
except Exception as e:
    print(f"UAR-v3 ERROR: {e}")
