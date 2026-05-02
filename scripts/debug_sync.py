import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def debug_sync_matching():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("Syncing MVITA specifically...")
    cur.execute("""
        UPDATE public.iebc_offices of
        SET 
            office_location = legacy.office_location,
            clean_office_location = legacy.clean_office_location,
            landmark = legacy.landmark,
            office_type = 'REGISTRATION_CENTRE'
        FROM public.iebc_offices_legacy_backup legacy
        WHERE UPPER(of.county) = 'MOMBASA' 
          AND UPPER(legacy.county) = 'MOMBASA'
          AND (UPPER(legacy.constituency) = 'MVITA' OR UPPER(legacy.constituency_name) = 'MVITA')
          AND UPPER(of.constituency_name) = 'MVITA'
          AND (
            UPPER(TRIM(of.office_location)) = UPPER(TRIM(legacy.landmark))
            OR similarity(of.office_location, legacy.landmark) > 0.4
          )
    """)
    conn.commit()
    print("Mvita sync complete.")
    
    cur.execute("SELECT office_location, landmark FROM public.iebc_offices WHERE constituency_name = 'MVITA' LIMIT 5")
    for row in cur.fetchall():
        print(f"Name: {row[0]} | Mark: {row[1]}")
        
    conn.close()

if __name__ == "__main__":
    debug_sync_matching()
