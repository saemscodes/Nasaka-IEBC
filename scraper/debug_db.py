import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
# We use the specific connection string format that handles passwords with special characters
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

print(f"Connecting to: {db_url.split('@')[1] if '@' in db_url else 'unknown'}")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # 1. Total centres
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'")
    total = cur.fetchone()[0]
    
    # 2. Non-null RO
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE returning_officer_name IS NOT NULL")
    ro_count = cur.fetchone()[0]
    
    print(f"TOTAL CENTRES: {total}")
    print(f"RECORDS WITH RO NAME: {ro_count}")
    
    # 3. Check sample ID 190757
    cur.execute("SELECT id, office_location, returning_officer_name FROM public.iebc_offices WHERE id = 190757")
    row = cur.fetchone()
    print(f"ID 190757 Audit: {row}")
    
    # 4. Check IDs 1-12
    cur.execute("SELECT id, office_location, returning_officer_name FROM public.iebc_offices WHERE id <= 12 ORDER BY id ASC")
    offices = cur.fetchall()
    print("IDs 1-12 Audit:")
    for o in offices:
        print(f"  {o}")
        
    # 5. Check if 'notes' contains the names for ID 1
    cur.execute("SELECT notes FROM public.iebc_offices WHERE id = 1")
    notes = cur.fetchone()[0]
    print(f"ID 1 NOTES: {notes[:100]}...")
    
    conn.close()
except Exception as e:
    print(f"DB ERROR: {e}")
