import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def get_orphans():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT id, county, constituency_name, office_location, latitude, longitude FROM public.iebc_offices WHERE (landmark IS NULL OR landmark = '') AND (latitude IS NOT NULL AND longitude IS NOT NULL) LIMIT 5")
    samples = cur.fetchall()
    for s in samples:
        print(f"ID: {s[0]} | County: {s[1]} | Const: {s[2]} | Current: {s[3]} | Coords: {s[4]}, {s[5]}")
    conn.close()

if __name__ == "__main__":
    get_orphans()
