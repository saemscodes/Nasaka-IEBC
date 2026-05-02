"""
Find the EXACT matching strategy by comparing the actual text stored in both tables.
"""
import os, psycopg2
from dotenv import load_dotenv

def compare():
    load_dotenv()
    conn = psycopg2.connect(os.environ['SUPABASE_DB_POOLED_URL'])
    cur = conn.cursor()

    # What does office_location look like for Baringo?
    cur.execute("""
        SELECT office_location, county, constituency, ward, geocode_status 
        FROM public.iebc_offices 
        WHERE county ILIKE '%BARINGO%' 
        ORDER BY office_location 
        LIMIT 10
    """)
    print("=== iebc_offices Baringo samples (office_location) ===")
    for r in cur.fetchall():
        print(f"  '{r[0]}' | county='{r[1]}' | constit='{r[2]}' | ward='{r[3]}' | status={r[4]}")

    # What does name look like in registration_centres for Baringo?
    cur.execute("""
        SELECT name, county, constituency, ward 
        FROM public.iebc_registration_centres 
        WHERE county ILIKE '%BARINGO%' 
        ORDER BY name 
        LIMIT 10
    """)
    print("\n=== iebc_registration_centres Baringo samples (name) ===")
    for r in cur.fetchall():
        print(f"  '{r[0]}' | county='{r[1]}' | constit='{r[2]}' | ward='{r[3]}'")

    # Direct cross-check: find an exact name match
    cur.execute("""
        SELECT rc.name, of.office_location, rc.county, of.county, rc.constituency, of.constituency
        FROM public.iebc_registration_centres rc
        JOIN public.iebc_offices of ON UPPER(TRIM(rc.name)) = UPPER(TRIM(of.office_location)) 
            AND UPPER(TRIM(rc.county)) = UPPER(TRIM(of.county))
        WHERE rc.county ILIKE '%BARINGO%'
        LIMIT 5
    """)
    matches = cur.fetchall()
    print(f"\n=== CROSS-TABLE EXACT JOIN (Baringo): {len(matches)} matches ===")
    for r in matches:
        print(f"  RC.name='{r[0]}' OF.loc='{r[1]}' RC.county='{r[2]}' OF.county='{r[3]}' RC.constit='{r[4]}' OF.constit='{r[5]}'")

    # Normalized cross-check
    cur.execute("""
        SELECT count(*) 
        FROM public.iebc_registration_centres rc
        JOIN public.iebc_offices of ON UPPER(TRIM(rc.name)) = UPPER(TRIM(of.office_location))
            AND UPPER(TRIM(rc.county)) = UPPER(TRIM(of.county))
    """)
    print(f"\n=== TOTAL CROSS-TABLE MATCHES (name=office_location + county): {cur.fetchone()[0]} ===")

    # Fuzzy: what about REGEXP_REPLACE for multi-spaces?
    cur.execute("""
        SELECT count(*) 
        FROM public.iebc_registration_centres rc
        JOIN public.iebc_offices of 
            ON UPPER(TRIM(REGEXP_REPLACE(rc.name, '\\s+', ' ', 'g'))) = UPPER(TRIM(REGEXP_REPLACE(of.office_location, '\\s+', ' ', 'g')))
            AND UPPER(TRIM(REGEXP_REPLACE(rc.county, '\\s+', ' ', 'g'))) = UPPER(TRIM(REGEXP_REPLACE(of.county, '\\s+', ' ', 'g')))
    """)
    print(f"=== TOTAL with space-normalization: {cur.fetchone()[0]} ===")

    conn.close()

if __name__ == "__main__":
    compare()
