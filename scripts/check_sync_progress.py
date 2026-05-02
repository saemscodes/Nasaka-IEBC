import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def check_progress():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    print("--- MOMBASA Sync Results ---")
    cur.execute("SELECT office_location, clean_office_location, landmark FROM public.iebc_offices WHERE county = 'MOMBASA' AND constituency_name = 'MVITA' LIMIT 10")
    for row in cur.fetchall():
        print(f"Name: {row[0]} | Clean: {row[1]} | Landmark: {row[2]}")
        
    conn.close()

if __name__ == "__main__":
    check_progress()
