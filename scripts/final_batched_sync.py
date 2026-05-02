import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

from tqdm import tqdm

def batched_sync():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute("SELECT DISTINCT county FROM public.iebc_offices WHERE county IS NOT NULL")
    counties = [r[0] for r in cur.fetchall()]
    
    for county in tqdm(counties, desc="Syncing Counties"):
        cur.execute("""
            UPDATE public.iebc_offices of
            SET 
                office_location = legacy.office_location,
                clean_office_location = legacy.clean_office_location,
                landmark = legacy.landmark,
                direction_type = legacy.direction_type,
                direction_landmark = legacy.direction_landmark,
                direction_distance = legacy.direction_distance
            FROM public.iebc_offices_legacy_backup legacy
            WHERE UPPER(TRIM(of.county)) = UPPER(TRIM(%s))
              AND UPPER(TRIM(legacy.county)) = UPPER(TRIM(%s))
              AND (UPPER(TRIM(of.constituency_name)) = UPPER(TRIM(legacy.constituency)) 
                   OR UPPER(TRIM(of.constituency_name)) = UPPER(TRIM(legacy.constituency_name)))
              AND (
                UPPER(TRIM(of.office_location)) = UPPER(TRIM(legacy.landmark))
                OR UPPER(TRIM(of.office_location)) = UPPER(TRIM(legacy.office_location))
                OR similarity(of.office_location, legacy.landmark) > 0.3
              )
        """, (county, county))
        conn.commit()
            
    # Mark Constituency Offices
    print("Marking Constituency Offices...")
    cur.execute("""
        UPDATE public.iebc_offices
        SET office_type = 'CONSTITUENCY_OFFICE'
        WHERE (office_location ILIKE '%Constituency Office%'
           OR office_location ILIKE '%Returning Officer%')
           AND office_type IS DISTINCT FROM 'CONSTITUENCY_OFFICE'
    """)
    conn.commit()
    
    conn.close()

if __name__ == "__main__":
    batched_sync()
