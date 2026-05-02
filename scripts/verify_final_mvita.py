import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def verify_final_mvita():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT id, office_location, landmark FROM public.iebc_offices WHERE constituency_name = 'MVITA' LIMIT 10")
    rows = cur.fetchall()
    print("FINAL MVITA IDENTIFIERS:")
    for row in rows:
        print(f"ID: {row[0]} | Loc: {row[1]} | Mark: {row[2]}")
    conn.close()

if __name__ == "__main__":
    verify_final_mvita()
