import os, csv, psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

def recovery_final():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("=== FINAL MISSION-CRITICAL RESTORATION ===\n")
    
    # 1. Clear temp and load CSV
    cur.execute("DROP TABLE IF EXISTS temp_final;")
    cur.execute("CREATE TEMPORARY TABLE temp_final (county TEXT, constituency_name TEXT, constituency TEXT, office_location TEXT, clean_office_location TEXT, landmark TEXT, constituency_code TEXT, county_code TEXT, ward_code TEXT, ward TEXT, centre_code TEXT, office_type TEXT, category TEXT, source TEXT, created_at TEXT);")
    with open("data/processed/cleaned_iebc_offices.csv", 'r', encoding='utf-8') as f:
        r = csv.reader(f)
        next(r)
        rows = [row for row in r if len(row) >= 11]
        execute_values(cur, "INSERT INTO temp_final VALUES %s", rows)
    print(f"      Loaded {len(rows)} records into temp storage.")

    # 2. Re-import Registration Centres (Missing ones)
    print("[1/3] Restoring missing Registration Centres...")
    cur.execute("""
        INSERT INTO public.iebc_offices (
            county, constituency, office_location, clean_office_location, 
            landmark, constituency_code, county_code, ward_code, ward, 
            centre_code, office_type, category, caw_code, source, created_at, updated_at
        )
        SELECT DISTINCT ON (ward_code, centre_code)
            s.county, s.constituency, s.office_location, s.clean_office_location, 
            s.landmark, s.constituency_code::integer, s.county_code, s.ward_code, s.ward, 
            s.centre_code, 'REGISTRATION_CENTRE', s.category, s.ward_code || s.centre_code,
            'RECOVERY_FIX', NOW(), NOW()
        FROM temp_final s
        LEFT JOIN public.iebc_offices t ON t.centre_code = s.centre_code AND t.ward_code = s.ward_code
        WHERE t.id IS NULL AND s.ward_code IS NOT NULL AND s.centre_code IS NOT NULL;
    """)
    print(f"      Restored {cur.rowcount} centres.")

    # 3. Restore Administrative Offices (With correct types)
    print("[2/3] Restoring Administrative Offices...")
    cur.execute("""
        INSERT INTO public.iebc_offices (
            county, constituency, office_location, clean_office_location, 
            landmark, constituency_code, county_code, ward_code, ward, 
            centre_code, office_type, category, caw_code, source, created_at, updated_at
        )
        SELECT DISTINCT ON (constituency_code)
            s.county, s.constituency, s.office_location, s.clean_office_location, 
            s.landmark, s.constituency_code::integer, s.county_code, s.ward_code, s.ward, 
            s.centre_code, 'CONSTITUENCY_OFFICE', 'Administrative', s.ward_code || s.centre_code,
            'RECOVERY_OFFICE_FIX', NOW(), NOW()
        FROM temp_final s
        LEFT JOIN public.iebc_offices t ON t.constituency_code = s.constituency_code::integer AND t.office_type = 'CONSTITUENCY_OFFICE'
        WHERE s.constituency_code IS NOT NULL AND s.constituency_code != '' AND t.id IS NULL
        AND s.office_location ilike '%Office%';
    """)
    print(f"      Restored {cur.rowcount} constituency offices.")

    # 4. Final Cleanup (Deduplicating any created overlaps)
    print("[3/3] Final surgical dedup...")
    cur.execute("""
        WITH dups AS (
            SELECT id, ROW_NUMBER() OVER(PARTITION BY ward_code, centre_code ORDER BY latitude DESC NULLS LAST, updated_at DESC) as rnk
            FROM public.iebc_offices WHERE ward_code IS NOT NULL AND centre_code IS NOT NULL
        )
        DELETE FROM public.iebc_offices WHERE id IN (SELECT id FROM dups WHERE rnk > 1);
    """)

    # 5. Result Verification
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    print(f"\nFINAL DB COUNT: {cur.fetchone()[0]}")
    conn.close()

if __name__ == "__main__": recovery_final()
