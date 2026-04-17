import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("--- ID 8 AUDIT (LUNGA LUNGA) ---")
    cur.execute("SELECT id, office_location, returning_officer_name, returning_officer_email FROM public.iebc_offices WHERE id = 8")
    row = cur.fetchone()
    print(f"ID 8: {row}")
    
    print("\n--- ID 1 AUDIT (CHANGAMWE) ---")
    cur.execute("SELECT id, office_location, returning_officer_name, returning_officer_email FROM public.iebc_offices WHERE id = 1")
    row1 = cur.fetchone()
    print(f"ID 1: {row1}")

    conn.close()
except Exception as e:
    print(f"AUDIT ERROR: {e}")
