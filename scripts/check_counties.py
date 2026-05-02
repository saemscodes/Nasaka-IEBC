import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def check_counties():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT county, count(*) FROM public.iebc_offices GROUP BY county ORDER BY count(*) DESC")
    rows = cur.fetchall()
    print("COUNTY DISTRIBUTION:")
    for county, count in rows:
        print(f"{county}: {count}")
    
    # Check MOMBASA specifically
    cur.execute("SELECT id, office_location, constituency_name, county FROM public.iebc_offices WHERE constituency_name ILIKE '%MVITA%' LIMIT 5")
    mvita = cur.fetchall()
    print("\nMVITA SAMPLES:")
    for row in mvita:
        print(row)
    
    conn.close()

if __name__ == "__main__":
    check_counties()
