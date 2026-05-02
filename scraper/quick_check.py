import os, psycopg2
from dotenv import load_dotenv

def quick_check():
    load_dotenv()
    conn = psycopg2.connect(os.environ['SUPABASE_DB_POOLED_URL'])
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM public.iebc_registration_centres WHERE latitude IS NOT NULL")
    print(f"RC with coords: {cur.fetchone()[0]}")
    cur.execute("SELECT count(*) FROM public.iebc_offices WHERE latitude IS NOT NULL AND office_type='REGISTRATION_CENTRE'")
    print(f"OF with coords: {cur.fetchone()[0]}")
    cur.execute("SELECT COALESCE(location_source,'NULL'), count(*) FROM public.iebc_registration_centres WHERE latitude IS NOT NULL GROUP BY location_source ORDER BY count(*) DESC")
    print("RC by source:")
    for r in cur.fetchall():
        print(f"  {r[0]}: {r[1]}")
    conn.close()

if __name__ == "__main__": quick_check()
