import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

sql = """
BEGIN;

-- 1. Restore legacy descriptive names
UPDATE public.iebc_offices of
SET 
    office_location = legacy.office_location,
    clean_office_location = legacy.clean_office_location,
    landmark = legacy.landmark,
    direction_type = legacy.direction_type,
    direction_landmark = legacy.direction_landmark,
    direction_distance = legacy.direction_distance
FROM public.iebc_offices_legacy_backup legacy
WHERE 
    UPPER(of.county) = UPPER(legacy.county)
    AND UPPER(of.constituency_name) = UPPER(legacy.constituency_name)
    AND (
        UPPER(of.office_location) = UPPER(legacy.landmark) 
        OR UPPER(of.office_location) = UPPER(legacy.office_location)
        OR similarity(of.office_location, legacy.landmark) > 0.4
        OR (of.office_location ILIKE '%' || legacy.landmark || '%' AND length(legacy.landmark) > 5)
    );

-- 2. Restore exact constituency names (ensure MVITA etc. are set correctly)
UPDATE public.iebc_offices
SET constituency_name = UPPER(constituency_name)
WHERE constituency_name IS NOT NULL;

-- 3. Mark Constituency Offices correctly
UPDATE public.iebc_offices
SET office_type = 'CONSTITUENCY_OFFICE'
WHERE office_location ILIKE '%Constituency Office%'
   OR office_location ILIKE '%Returning Officer%';

COMMIT;
"""

def execute_sync():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    print("Executing Hierarchical Restoration SQL...")
    cur.execute(sql)
    conn.commit()
    print("SQL execution complete.")
    
    cur.execute("SELECT count(*) FROM public.iebc_offices WHERE landmark IS NOT NULL")
    count = cur.fetchone()[0]
    print(f"Verified non-null landmarks: {count}")
    
    conn.close()

if __name__ == "__main__":
    execute_sync()
