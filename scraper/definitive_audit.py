"""
Definitive schema and relational audit across both IEBC tables.
Answers ALL outstanding questions in one shot.
"""
import os, psycopg2
from dotenv import load_dotenv

def audit():
    load_dotenv()
    conn = psycopg2.connect(os.environ['SUPABASE_DB_POOLED_URL'])
    cur = conn.cursor()

    # 1. iebc_registration_centres schema
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='iebc_registration_centres' ORDER BY ordinal_position")
    rc_cols = [r[0] for r in cur.fetchall()]
    print(f"[RC] Columns ({len(rc_cols)}): {rc_cols}")

    # 2. iebc_offices schema  
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='iebc_offices' ORDER BY ordinal_position")
    of_cols = [r[0] for r in cur.fetchall()]
    print(f"[OF] Columns ({len(of_cols)}): {of_cols}")

    # 3. Counts
    cur.execute("SELECT count(*) FROM public.iebc_registration_centres")
    print(f"[RC] Total rows: {cur.fetchone()[0]}")
    cur.execute("SELECT count(*) FROM public.iebc_offices WHERE office_type='REGISTRATION_CENTRE'")
    print(f"[OF] Total REGISTRATION_CENTRE rows: {cur.fetchone()[0]}")

    # 4. Sample from RC
    cur.execute("SELECT id, name, county, constituency, ward, latitude, longitude FROM public.iebc_registration_centres WHERE county='BARINGO' LIMIT 3")
    print("\n[RC] Sample Baringo:")
    for r in cur.fetchall():
        print(f"  id={r[0]} name='{r[1]}' county='{r[2]}' constit='{r[3]}' ward='{r[4]}' lat={r[5]} lng={r[6]}")

    # 5. Sample from OF (same county)
    cur.execute("SELECT id, office_location, county, constituency, ward, latitude, longitude, geocode_status FROM public.iebc_offices WHERE office_type='REGISTRATION_CENTRE' AND county='BARINGO' LIMIT 3")
    print("\n[OF] Sample Baringo:")
    for r in cur.fetchall():
        print(f"  id={r[0]} loc='{r[1]}' county='{r[2]}' constit='{r[3]}' ward='{r[4]}' lat={r[5]} lng={r[6]} status={r[7]}")

    # 6. Check if mapping_uuid exists and is populated
    if 'mapping_uuid' in of_cols:
        cur.execute("SELECT count(*) FROM public.iebc_offices WHERE mapping_uuid IS NOT NULL")
        print(f"\n[OF] mapping_uuid populated: {cur.fetchone()[0]}")
        cur.execute("SELECT id, mapping_uuid FROM public.iebc_offices WHERE mapping_uuid IS NOT NULL LIMIT 3")
        for r in cur.fetchall():
            print(f"  OF.id={r[0]} -> RC.id(mapping_uuid)={r[1]}")
    else:
        print("\n[OF] mapping_uuid column NOT PRESENT")

    # 7. Test the exact match: AYATYA PRIMARY SCHOOL
    test_name = "AYATYA PRIMARY SCHOOL"
    cur.execute("SELECT id, name, county, constituency FROM public.iebc_registration_centres WHERE name=%s", (test_name,))
    rc_match = cur.fetchone()
    print(f"\n[RC] Direct match for '{test_name}': {rc_match}")

    cur.execute("SELECT id, office_location, county, constituency FROM public.iebc_offices WHERE office_location=%s AND office_type='REGISTRATION_CENTRE'", (test_name,))
    of_match = cur.fetchone()
    print(f"[OF] Direct match for '{test_name}': {of_match}")

    # 8. Test ILIKE match
    cur.execute("SELECT count(*) FROM public.iebc_offices WHERE office_location ILIKE %s AND office_type='REGISTRATION_CENTRE'", (test_name,))
    print(f"[OF] ILIKE match count: {cur.fetchone()[0]}")

    # 9. Check if RC has geocode columns
    has_lat = 'latitude' in rc_cols
    has_status = 'geocode_status' in [c.lower() for c in rc_cols]
    print(f"\n[RC] Has latitude: {has_lat}, Has geocode_status: {has_status}")

    conn.close()

if __name__ == "__main__":
    audit()
