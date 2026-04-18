import os, psycopg2
from dotenv import load_dotenv

def inspect():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT id, office_location, office_type, ward_code, centre_code FROM public.iebc_offices WHERE ward_code = '0788' AND centre_code = '042'")
    for r in cur.fetchall():
        print(r)
    conn.close()

if __name__ == "__main__": inspect()
