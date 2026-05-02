import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def inspect_mvita():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    print("Searching for MVITA in iebc_offices...")
    cur.execute("SELECT id, county, constituency_name, office_location, office_type FROM public.iebc_offices WHERE constituency_name ILIKE '%MVITA%'")
    rows = cur.fetchall()
    for row in rows:
        print(row)
    
    print("\nSearching for MVITA in iebc_offices_legacy_backup...")
    cur.execute("SELECT id, county, constituency_name, office_location FROM public.iebc_offices_legacy_backup WHERE constituency_name ILIKE '%MVITA%' LIMIT 5")
    rows = cur.fetchall()
    for row in rows:
        print(row)
        
    conn.close()

if __name__ == "__main__":
    inspect_mvita()
