import os, psycopg2
from dotenv import load_dotenv

def audit_schema():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    for table in ['iebc_offices', 'iebc_registration_centres']:
        print(f"\n--- AUDITING SCHEMA: public.{table} ---")
        cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '{table}'")
        cols = [r[0] for r in cur.fetchall()]
        print(f"Columns: {cols}")
        
    conn.close()

if __name__ == "__main__": audit_schema()
