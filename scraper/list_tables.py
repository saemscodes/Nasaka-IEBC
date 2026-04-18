import os, psycopg2
from dotenv import load_dotenv

def list_tables():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    for r in cur.fetchall():
        print(r[0])
    conn.close()

if __name__ == "__main__": list_tables()
