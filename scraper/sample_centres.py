import os, psycopg2
from dotenv import load_dotenv

def sample_centres():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT centre_code, name, ward, constituency FROM public.iebc_registration_centres LIMIT 10")
    for r in cur.fetchall():
        print(f"Code: {r[0]} | Name: {r[1]} | Ward: {r[2]} | Const: {r[3]}")
    conn.close()

if __name__ == "__main__": sample_centres()
