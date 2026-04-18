import os, psycopg2
from dotenv import load_dotenv

def inspect_schema():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'iebc_registration_centres'")
    for r in cur.fetchall():
        print(f"{r[0]}: {r[1]}")
    conn.close()

if __name__ == "__main__": inspect_schema()
