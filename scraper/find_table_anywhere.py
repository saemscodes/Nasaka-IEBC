import os, psycopg2
from dotenv import load_dotenv

def find_table():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name ILIKE '%registration%' OR table_name ILIKE '%centre%'")
    for r in cur.fetchall():
        print(f"{r[0]}.{r[1]}")
    conn.close()

if __name__ == "__main__": find_table()
