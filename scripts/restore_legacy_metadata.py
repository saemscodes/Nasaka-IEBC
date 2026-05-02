import psycopg2
import os
import re
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def normalize(text):
    if not text: return ""
    return re.sub(r'\s+', ' ', str(text).strip()).upper()

def sync_metadata():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("Fetching legacy metadata...")
    cur.execute("""
        SELECT 
            id, county, constituency_name, office_location, 
            landmark, clean_office_location, direction_type, direction_landmark, direction_distance,
            office_type
        FROM public.iebc_offices_legacy_backup
    """)
    legacy_rows = cur.fetchall()
    print(f"Found {len(legacy_rows)} legacy records.")

    updates = 0
    for row in legacy_rows:
        lid, lcounty, lconst, lloc, lmark, lclean, ldtype, ldmark, lddist, lotype = row
        
        # Try to find match in production iebc_offices
        # Match by normalized name + county + constituency
        norm_loc = normalize(lloc)
        norm_county = normalize(lcounty)
        norm_const = normalize(lconst)
        
        cur.execute("""
            UPDATE public.iebc_offices
            SET 
                landmark = %s,
                clean_office_location = %s,
                direction_type = %s,
                direction_landmark = %s,
                direction_distance = %s,
                office_type = COALESCE(office_type, %s)
            WHERE 
                UPPER(TRIM(REGEXP_REPLACE(office_location, '\\s+', ' ', 'g'))) = %s
                AND UPPER(TRIM(REGEXP_REPLACE(county, '\\s+', ' ', 'g'))) = %s
                AND UPPER(TRIM(REGEXP_REPLACE(constituency_name, '\\s+', ' ', 'g'))) = %s
                AND (landmark IS NULL OR clean_office_location IS NULL)
        """, (lmark, lclean, ldtype, ldmark, lddist, lotype, norm_loc, norm_county, norm_const))
        
        if cur.rowcount > 0:
            updates += cur.rowcount
            if updates % 100 == 0:
                print(f"Synced {updates} records...")

    conn.commit()
    print(f"Finished. Total records updated: {updates}")
    
    # Secondary pass: Fix office_type for obvious constituency offices
    print("Refining office types...")
    cur.execute("""
        UPDATE public.iebc_offices
        SET office_type = 'CONSTITUENCY_OFFICE'
        WHERE (office_location ILIKE '%%Constituency Office%%' 
           OR office_location ILIKE '%%Returning Officer%%')
          AND office_type != 'CONSTITUENCY_OFFICE'
    """)
    print(f"Marked {cur.rowcount} constituency offices.")
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    sync_metadata()
