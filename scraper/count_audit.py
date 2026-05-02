import os, psycopg2
from dotenv import load_dotenv

def count_audit():
    load_dotenv()
    conn = psycopg2.connect(os.environ['SUPABASE_DB_POOLED_URL'])
    cur = conn.cursor()

    cur.execute("SELECT count(*) FROM public.iebc_registration_centres")
    print(f"iebc_registration_centres total: {cur.fetchone()[0]}")

    cur.execute("SELECT count(*) FROM public.iebc_offices")
    print(f"iebc_offices total: {cur.fetchone()[0]}")

    cur.execute("SELECT office_type, count(*) FROM public.iebc_offices GROUP BY office_type ORDER BY count(*) DESC")
    print("iebc_offices by office_type:")
    for r in cur.fetchall():
        print(f"  {r[0]}: {r[1]}")

    cur.execute("SELECT count(*) FROM public.iebc_offices WHERE latitude IS NOT NULL")
    print(f"iebc_offices with coordinates: {cur.fetchone()[0]}")

    cur.execute("SELECT count(*) FROM public.iebc_registration_centres WHERE latitude IS NOT NULL")
    print(f"iebc_registration_centres with coordinates: {cur.fetchone()[0]}")

    # Check if data came from The Great Swap 
    cur.execute("SELECT count(*) FROM public.iebc_offices WHERE office_location = 'AYATYA PRIMARY SCHOOL'")
    print(f"Swap test (AYATYA in offices): {cur.fetchone()[0]}")

    cur.execute("SELECT count(*) FROM public.iebc_offices WHERE geocode_status IS NOT NULL AND geocode_status != 'pending'")
    print(f"iebc_offices actively geocoded: {cur.fetchone()[0]}")

    # Check legacy backup existence
    cur.execute("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='iebc_offices_legacy_backup')")
    print(f"iebc_offices_legacy_backup exists: {cur.fetchone()[0]}")

    conn.close()

if __name__ == "__main__":
    count_audit()
