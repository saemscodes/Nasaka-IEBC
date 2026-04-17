import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Check Counties
    cur.execute("SELECT * FROM public.counties LIMIT 0")
    print(f"COUNTIES COLS: {[desc[0] for desc in cur.description]}")
    
    # Check Wards
    cur.execute("SELECT * FROM public.wards LIMIT 0")
    print(f"WARDS COLS: {[desc[0] for desc in cur.description]}")
    
    conn.close()
except Exception as e:
    print(f"SCHEMA ERROR: {e}")
