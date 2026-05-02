"""Debug Phase 2: Why does the JOIN UPDATE return 0?"""
import os, psycopg2
from dotenv import load_dotenv

def debug_phase2():
    load_dotenv()
    conn = psycopg2.connect(os.environ['SUPABASE_DB_POOLED_URL'])
    cur = conn.cursor()

    # Verify Phase 1 worked
    cur.execute("SELECT name, county, latitude, longitude FROM public.iebc_registration_centres WHERE latitude IS NOT NULL LIMIT 5")
    print("RC rows with coords:")
    for r in cur.fetchall():
        print(f"  '{r[0]}' county='{r[1]}' lat={r[2]} lng={r[3]}")

    # Test the exact join conditions from Phase 2 as a SELECT first
    cur.execute("""
        SELECT of.id, of.office_location, of.county, rc.name, rc.county, rc.latitude
        FROM public.iebc_registration_centres AS rc
        JOIN public.iebc_offices AS of 
            ON UPPER(TRIM(REGEXP_REPLACE(of.office_location, '\\s+', ' ', 'g'))) = UPPER(TRIM(REGEXP_REPLACE(rc.name, '\\s+', ' ', 'g')))
            AND UPPER(TRIM(REGEXP_REPLACE(of.county, '\\s+', ' ', 'g'))) = UPPER(TRIM(REGEXP_REPLACE(rc.county, '\\s+', ' ', 'g')))
        WHERE of.office_type = 'REGISTRATION_CENTRE'
          AND rc.latitude IS NOT NULL
        LIMIT 5
    """)
    matches = cur.fetchall()
    print(f"\nPhase 2 SELECT test: {len(matches)} rows")
    for r in matches:
        print(f"  OF.id={r[0]} OF.loc='{r[1]}' OF.county='{r[2]}' RC.name='{r[3]}' RC.county='{r[4]}' RC.lat={r[5]}")

    # Check OF.id type
    if matches:
        print(f"\n  OF.id type: {type(matches[0][0])}")

    conn.close()

if __name__ == "__main__":
    debug_phase2()
