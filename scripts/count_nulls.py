import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def count_nulls():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM public.iebc_offices WHERE landmark IS NULL OR landmark = ''")
    row = cur.fetchone()
    print(f"REMAINING MISSING LANDMARKS: {row[0]}")
    
    # Get a sample of 5 to enrich
    cur.execute("SELECT id, county, constituency_name, office_location, latitude, longitude FROM public.iebc_offices WHERE (landmark IS NULL OR landmark = '') AND (latitude IS NOT NULL AND longitude IS NOT NULL) LIMIT 10")
    samples = cur.fetchall()
    print("\nSAMPLE RECORDS FOR ENRICHMENT:")
    for s in samples:
        print(s)
    
    conn.close()

if __name__ == "__main__":
    count_nulls()
