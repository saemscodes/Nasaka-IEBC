import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def final_ham_sync():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("GOING HAM ON SYNC...")
    # Update MOMBASA (as proof)
    cur.execute("""
        UPDATE public.iebc_offices of
        SET 
            office_location = legacy.office_location,
            clean_office_location = legacy.clean_office_location,
            landmark = legacy.landmark
        FROM public.iebc_offices_legacy_backup legacy
        WHERE UPPER(of.county) = 'MOMBASA'
          AND UPPER(legacy.county) = 'MOMBASA'
          AND (
            of.office_location ILIKE '%%' || legacy.landmark || '%%'
            OR legacy.landmark ILIKE '%%' || of.office_location || '%%'
            OR similarity(of.office_location, legacy.landmark) > 0.2
          )
    """)
    print(f"Mombasa updated: {cur.rowcount} rows")
    
    # Update ALL
    cur.execute("""
        UPDATE public.iebc_offices of
        SET 
            office_location = legacy.office_location,
            clean_office_location = legacy.clean_office_location,
            landmark = legacy.landmark
        FROM public.iebc_offices_legacy_backup legacy
        WHERE UPPER(of.county) = UPPER(legacy.county)
          AND (
            of.office_location ILIKE '%%' || legacy.landmark || '%%'
            OR legacy.landmark ILIKE '%%' || of.office_location || '%%'
            OR similarity(of.office_location, legacy.landmark) > 0.2
          )
    """)
    print(f"Global updated: {cur.rowcount} rows")
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    final_ham_sync()
