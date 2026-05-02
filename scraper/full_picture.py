"""
Full picture audit: understand the exact relationship between RC and OF.
How many RC records match OF? How many OF records have no RC match?
"""
import os, psycopg2
from dotenv import load_dotenv

def full_picture():
    load_dotenv()
    conn = psycopg2.connect(os.environ['SUPABASE_DB_POOLED_URL'])
    cur = conn.cursor()

    # 1. How many RC match OF via normalized name+county?
    cur.execute("""
        SELECT count(DISTINCT rc.id) 
        FROM public.iebc_registration_centres rc
        JOIN public.iebc_offices of 
            ON UPPER(TRIM(REGEXP_REPLACE(rc.name, '\\s+', ' ', 'g'))) = UPPER(TRIM(REGEXP_REPLACE(of.office_location, '\\s+', ' ', 'g')))
            AND UPPER(TRIM(REGEXP_REPLACE(rc.county, '\\s+', ' ', 'g'))) = UPPER(TRIM(REGEXP_REPLACE(of.county, '\\s+', ' ', 'g')))
        WHERE of.office_type = 'REGISTRATION_CENTRE'
    """)
    print(f"RC records that match OF (name+county): {cur.fetchone()[0]} / 24369")

    # 2. How many OF have coords but NO RC match?
    cur.execute("""
        SELECT count(*) 
        FROM public.iebc_offices of
        LEFT JOIN public.iebc_registration_centres rc 
            ON UPPER(TRIM(REGEXP_REPLACE(of.office_location, '\\s+', ' ', 'g'))) = UPPER(TRIM(REGEXP_REPLACE(rc.name, '\\s+', ' ', 'g')))
            AND UPPER(TRIM(REGEXP_REPLACE(of.county, '\\s+', ' ', 'g'))) = UPPER(TRIM(REGEXP_REPLACE(rc.county, '\\s+', ' ', 'g')))
        WHERE of.office_type = 'REGISTRATION_CENTRE'
          AND of.latitude IS NOT NULL
          AND rc.id IS NULL
    """)
    print(f"OF with coords but NO RC match: {cur.fetchone()[0]}")

    # 3. Sample: RC records that DON'T match ANY OF
    cur.execute("""
        SELECT rc.name, rc.county, rc.constituency
        FROM public.iebc_registration_centres rc
        LEFT JOIN public.iebc_offices of 
            ON UPPER(TRIM(REGEXP_REPLACE(rc.name, '\\s+', ' ', 'g'))) = UPPER(TRIM(REGEXP_REPLACE(of.office_location, '\\s+', ' ', 'g')))
            AND UPPER(TRIM(REGEXP_REPLACE(rc.county, '\\s+', ' ', 'g'))) = UPPER(TRIM(REGEXP_REPLACE(of.county, '\\s+', ' ', 'g')))
        WHERE of.id IS NULL AND rc.county = 'BARINGO'
        ORDER BY rc.name
        LIMIT 10
    """)
    print("\nRC Baringo records with NO OF match:")
    for r in cur.fetchall():
        print(f"  '{r[0]}' | '{r[1]}' | '{r[2]}'")

    # 4. What do OF Baringo records look like that have coords?
    cur.execute("""
        SELECT office_location, county, constituency, geocode_method, geocode_status 
        FROM public.iebc_offices 
        WHERE county = 'BARINGO' AND latitude IS NOT NULL
        ORDER BY office_location LIMIT 10
    """)
    print("\nOF Baringo records WITH coords:")
    for r in cur.fetchall():
        print(f"  '{r[0]}' | '{r[1]}' | '{r[2]}' | method={r[3]} | status={r[4]}")

    # 5. Sample OF Baringo records WITHOUT coords 
    cur.execute("""
        SELECT office_location, county, constituency, geocode_status 
        FROM public.iebc_offices 
        WHERE county = 'BARINGO' AND latitude IS NULL
        ORDER BY office_location LIMIT 10
    """)
    print("\nOF Baringo records WITHOUT coords:")
    for r in cur.fetchall():
        print(f"  '{r[0]}' | '{r[1]}' | '{r[2]}' | status={r[3]}")

    conn.close()

if __name__ == "__main__":
    full_picture()
