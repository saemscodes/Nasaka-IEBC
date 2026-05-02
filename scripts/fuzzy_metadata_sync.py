import psycopg2
import os
import re
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def normalize(text):
    if not text: return ""
    return re.sub(r'\s+', ' ', str(text).strip()).upper()

def fuzzy_sync():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("Enabling pg_trgm...")
    cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    conn.commit()

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
    matches = 0
    
    for row in legacy_rows:
        if len(row) != 10:
            print(f"Skipping row with unexpected length: {len(row)}")
            continue
        lid, lcounty, lconst, lloc, lmark, lclean, ldtype, ldmark, lddist, lotype = row
        
        # Fuzzy match within same county and constituency
        # Try both the name and the legacy landmarks/clean names
        cur.execute("""
            SELECT id, office_location, 
                   GREATEST(
                       similarity(office_location, %s),
                       similarity(office_location, %s),
                       similarity(office_location, %s)
                   ) as sim
            FROM public.iebc_offices
            WHERE UPPER(county) = UPPER(%s)
              AND UPPER(constituency_name) = UPPER(%s)
              AND (landmark IS NULL OR clean_office_location IS NULL)
            ORDER BY sim DESC
            LIMIT 1
        """, (lloc, lmark or "", lclean or "", lcounty, lconst))
        
        match = cur.fetchone()
        if match and match[2] > 0.4:
            target_id, target_loc, sim = match
            
            cur.execute("""
                UPDATE public.iebc_offices
                SET 
                    landmark = %s,
                    clean_office_location = %s,
                    direction_type = %s,
                    direction_landmark = %s,
                    direction_distance = %s,
                    office_type = COALESCE(office_type, %s)
                WHERE id = %s
            """, (lmark, lclean, ldtype, ldmark, lddist, lotype or 'REGISTRATION_CENTRE', target_id))
            
            updates += 1
            if updates % 100 == 0:
                print(f"Matched {updates} records...")
        
    conn.commit()
    print(f"Finished fuzzy sync. Total records updated: {updates}")
    
    # Final pass for Constituency Offices by name match
    cur.execute("""
        UPDATE public.iebc_offices
        SET office_type = 'CONSTITUENCY_OFFICE'
        WHERE office_location ILIKE '%%Constituency Office%%'
           OR office_location ILIKE '%%Returning Officer%%'
    """)
    print(f"Hard-marked {cur.rowcount} constituency offices.")
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    fuzzy_sync()
