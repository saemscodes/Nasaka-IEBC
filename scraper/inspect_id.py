import os, psycopg2
from dotenv import load_dotenv

def inspect_id():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT id, office_location, office_type, ward_code, centre_code FROM public.iebc_offices WHERE id = 158")
    print(cur.fetchall())
    conn.close()

if __name__ == "__main__": inspect_id()
