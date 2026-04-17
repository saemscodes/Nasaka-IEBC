import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Check Changamwe centres
    cur.execute("SELECT id, office_location, returning_officer_name FROM public.iebc_offices WHERE constituency = 'CHANGAMWE' AND office_type = 'REGISTRATION_CENTRE' AND returning_officer_name IS NOT NULL LIMIT 2")
    centres = cur.fetchall()
    print(f"CHANGAMWE Centres with RO: {centres}")
    
    # Check Changamwe Office (ID 1)
    cur.execute("SELECT id, office_location, returning_officer_name FROM public.iebc_offices WHERE id = 1")
    office = cur.fetchone()
    print(f"ID 1 Current state: {office}")
    
    conn.close()
except Exception as e:
    print(f"VERIFY ERROR: {e}")
