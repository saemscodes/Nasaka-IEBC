import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def test_direct_update():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("Test 1: Direct update by ID...")
    cur.execute("UPDATE public.iebc_offices SET office_location = 'ALLIDINA VISRAM HIGH SCHOOL (TEST)' WHERE id = 207216")
    print(f"Update 1: {cur.rowcount} rows")
    
    print("Test 2: Direct join-less update from legacy...")
    cur.execute("""
        UPDATE public.iebc_offices of
        SET office_location = legacy.office_location
        FROM public.iebc_offices_legacy_backup legacy
        WHERE of.id = 207216 AND legacy.id = 2791
    """)
    print(f"Update 2: {cur.rowcount} rows")
    
    conn.commit()
    
    cur.execute("SELECT office_location FROM public.iebc_offices WHERE id = 207216")
    print(f"Result: {cur.fetchone()[0]}")
    conn.close()

if __name__ == "__main__":
    test_direct_update()
