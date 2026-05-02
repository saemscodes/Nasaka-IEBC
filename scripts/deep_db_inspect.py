import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def deep_inspect():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("--- MVITA Search in iebc_offices ---")
    cur.execute("SELECT id, county, constituency_name, office_location, office_type FROM public.iebc_offices WHERE constituency_name ILIKE '%MVITA%'")
    for row in cur.fetchall():
        print(row)
        
    print("\n--- MVITA Search in iebc_offices_legacy_backup ---")
    cur.execute("SELECT id, county, constituency_name, office_location FROM public.iebc_offices_legacy_backup WHERE constituency_name ILIKE '%MVITA%' LIMIT 10")
    for row in cur.fetchall():
        print(row)

    print("\n--- County Stats ---")
    cur.execute("SELECT county, count(*) FROM public.iebc_offices GROUP BY county ORDER BY count(*) DESC LIMIT 5")
    for row in cur.fetchall():
        print(row)

    conn.close()

if __name__ == "__main__":
    deep_inspect()
