import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # 1. Check main table RO columns
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE returning_officer_name IS NOT NULL")
    print(f"Main table RO Name count: {cur.fetchone()[0]}")
    
    # 2. Check main table notes for patterns
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE notes LIKE '%RO_NAME:%'")
    print(f"Main table notes containing 'RO_NAME:': {cur.fetchone()[0]}")
    
    # 3. Check legacy backup table
    cur.execute("SELECT COUNT(*) FROM pg_tables WHERE tablename = 'iebc_offices_legacy_backup'")
    if cur.fetchone()[0] > 0:
        cur.execute("SELECT COUNT(*) FROM public.iebc_offices_legacy_backup WHERE notes LIKE '%RO_NAME:%'")
        print(f"Backup table notes containing 'RO_NAME:': {cur.fetchone()[0]}")
        cur.execute("SELECT id, notes FROM public.iebc_offices_legacy_backup WHERE notes LIKE '%RO_NAME:%' LIMIT 1")
        row = cur.fetchone()
        if row:
            print(f"Backup Sample: {row}")
    else:
        print("Legacy backup table does not exist.")
        
    # 4. Check if there are OTHER tables
    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'iebc%'")
    print(f"IEBC tables: {cur.fetchall()}")
    
    conn.close()
except Exception as e:
    print(f"HUNT ERROR: {e}")
