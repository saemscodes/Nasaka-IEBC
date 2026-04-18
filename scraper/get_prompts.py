import os, psycopg2
from dotenv import load_dotenv

def get_samples():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT office_location, ward, constituency, county FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' LIMIT 5")
    rows = cur.fetchall()
    for row in rows:
        loc, ward, con, county = row
        primary = f"{loc}, {ward}, {con}, {county} County, Kenya"
        print(primary)
    conn.close()

if __name__ == "__main__": get_samples()
