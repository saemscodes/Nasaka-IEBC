import os, psycopg2
from dotenv import load_dotenv

def check_count():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    print(f"Current Count: {cur.fetchone()[0]}")
    conn.close()

if __name__ == "__main__": check_count()
