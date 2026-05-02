import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def compare_mvita():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("--- PROD (iebc_offices) ---")
    cur.execute("SELECT id, office_location, landmark, constituency_name FROM public.iebc_offices WHERE constituency_name ILIKE '%MVITA%' LIMIT 10")
    for row in cur.fetchall():
        print(f"ID: {row[0]} | Loc: {row[1]} | Mark: {row[2]} | Const: {row[3]}")
        
    print("\n--- LEGACY (iebc_offices_legacy_backup) ---")
    cur.execute("SELECT id, office_location, landmark, constituency_name FROM public.iebc_offices_legacy_backup WHERE constituency_name ILIKE '%MVITA%' LIMIT 10")
    for row in cur.fetchall():
        print(f"ID: {row[0]} | Loc: {row[1]} | Mark: {row[2]} | Const: {row[3]}")
        
    conn.close()

if __name__ == "__main__":
    compare_mvita()
