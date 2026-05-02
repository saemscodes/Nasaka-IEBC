import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def dump_mvita_legacy():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    print("Dumping all MVITA legacy records...")
    cur.execute("SELECT * FROM public.iebc_offices_legacy_backup WHERE constituency ILIKE '%MVITA%' OR constituency_name ILIKE '%MVITA%'")
    colnames = [desc[0] for desc in cur.description]
    for row in cur.fetchall():
        print(dict(zip(colnames, row)))
    conn.close()

if __name__ == "__main__":
    dump_mvita_legacy()
