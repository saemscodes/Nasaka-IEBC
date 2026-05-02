import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def surgical_sync_mombasa():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("Surgical sync for MOMBASA...")
    cur.execute("""
        UPDATE public.iebc_offices of
        SET 
            office_location = legacy.office_location,
            clean_office_location = legacy.clean_office_location,
            landmark = legacy.landmark
        FROM public.iebc_offices_legacy_backup legacy
        WHERE UPPER(TRIM(of.county)) = 'MOMBASA'
          AND UPPER(TRIM(legacy.county)) = 'MOMBASA'
          AND (UPPER(TRIM(of.constituency_name)) = UPPER(TRIM(legacy.constituency)) 
               OR UPPER(TRIM(of.constituency_name)) = UPPER(TRIM(legacy.constituency_name)))
          AND (
            UPPER(TRIM(of.office_location)) = UPPER(TRIM(legacy.landmark))
            OR UPPER(TRIM(of.office_location)) = UPPER(TRIM(legacy.office_location))
            OR similarity(of.office_location, legacy.landmark) > 0.3
          )
    """)
    print(f"Updated: {cur.rowcount} rows")
    conn.commit()
    
    cur.execute("SELECT office_location, landmark FROM public.iebc_offices WHERE county = 'MOMBASA' AND constituency_name = 'MVITA' LIMIT 5")
    for row in cur.fetchall():
        print(f"Name: {row[0]} | Mark: {row[1]}")
        
    conn.close()

if __name__ == "__main__":
    surgical_sync_mombasa()
