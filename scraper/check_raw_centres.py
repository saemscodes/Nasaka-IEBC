import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # 1. Check if table exists
    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'iebc_registration_centres'")
    exists = cur.fetchone()
    if not exists:
        print("[AUDIT] Table 'public.iebc_registration_centres' does NOT exist.")
    else:
        print("[AUDIT] Table 'public.iebc_registration_centres' exists.")
        
        # 2. Search for Lunga Lunga in this specific table
        # We check columns likely to have the RO info (e.g., notes, or specific RO columns if they exist)
        cur.execute("SELECT * FROM public.iebc_registration_centres LIMIT 0")
        colnames = [desc[0] for desc in cur.description]
        print(f"Columns in Raw Table: {colnames}")
        
        cur.execute("SELECT * FROM public.iebc_registration_centres WHERE (constituency ILIKE '%LUNGA%') LIMIT 5")
        rows = cur.fetchall()
        print(f"Lunga Lunga Records Found: {len(rows)}")
        for r in rows:
            print(f"  {r}")
            
    conn.close()
except Exception as e:
    print(f"RAW AUDIT ERROR: {e}")
