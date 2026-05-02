import csv
import psycopg2
from psycopg2.extras import execute_values
import re
from datetime import datetime
import sys

# Database Configuration
PASSWORD = "1268Saem'sTunes!"
PROJECT_ID = "ftswzvqwxdwgkvfbwfpx"
BACKUP_TABLE = "public.iebc_offices_backup_20260425"
TARGET_TABLE = "public.iebc_offices"
CSV_PATH = r'C:\Users\Administrator\Downloads\290 CONSTITUENCY IEBC OFFICES - FAIR ATTEMPT.csv'

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")
    sys.stdout.flush()

def clean_name(name):
    if not name: return ""
    return str(name).strip().upper()

def parse_wkt(wkt):
    # POINT (lon lat) -> (lat, lon)
    match = re.search(r'POINT \(([^ ]+) ([^ ]+)\)', wkt)
    if match:
        return float(match.group(2)), float(match.group(1)) # lat, lon
    return None, None

def run_smart_ingest():
    try:
        log(f"--- STARTING SMART INGEST OPERATION ---")
        log(f"Connecting to database...")
        conn = psycopg2.connect(
            host="aws-0-eu-north-1.pooler.supabase.com",
            port=6543,
            user=f"postgres.{PROJECT_ID}",
            password=PASSWORD,
            dbname="postgres",
            sslmode='require'
        )
        cur = conn.cursor()
        
        # 1. LOAD BACKUP DATA
        log(f"Loading backup data from {BACKUP_TABLE}...")
        essential_cols = [
            'county', 'constituency_name', 'constituency', 'returning_officer_name', 
            'returning_officer_email', 'county_code', 'ward_code', 'constituency_code',
            'elevation_meters', 'walking_effort', 'category', 'office_type', 
            'ward', 'ward_id', 'caw_code', 'centre_code'
        ]
        cur.execute(f"SELECT {','.join(essential_cols)} FROM {BACKUP_TABLE}")
        backup_rows = cur.fetchall()
        
        backup_map = {}
        for row in backup_rows:
            data = dict(zip(essential_cols, row))
            key = (clean_name(data.get('county')), clean_name(data.get('constituency_name') or data.get('constituency')))
            if key not in backup_map: # Keep first match from backup (counties/consts should be unique in backup anyway)
                backup_map[key] = data
        
        log(f"Indexed {len(backup_map)} offices from backup.")

        # 2. PREPARE TARGET SCHEMA
        cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = 'iebc_offices' AND table_schema = 'public' ORDER BY ordinal_position;")
        target_columns = [row[0] for row in cur.fetchall() if row[0] != 'id'] 
        
        # 3. PARSE AND MERGE CSV
        log(f"Parsing CSV from {CSV_PATH}...")
        final_data_raw = []
        with open(CSV_PATH, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            headers = next(reader)
            
            for i, row in enumerate(reader):
                if not row or len(row) < 4: continue
                
                wkt = row[0]
                county = clean_name(row[1])
                const_name = clean_name(row[3])
                
                lat, lon = parse_wkt(wkt)
                match = backup_map.get((county, const_name))
                
                row_data = {}
                if match:
                    row_data = match.copy()
                
                row_data['county'] = row[1].strip()
                row_data['constituency_name'] = row[3].strip()
                row_data['constituency'] = row[3].strip()
                
                if lat is not None:
                    row_data['latitude'] = lat
                    row_data['longitude'] = lon
                    row_data['geom'] = f"SRID=4326;POINT({lon} {lat})"
                
                if len(row) > 16:
                    potential_loc = " ".join([r.strip() for r in row[4:-6] if r.strip()])
                    if potential_loc:
                        row_data['office_location'] = potential_loc
                else:
                    if len(row) > 4: row_data['office_location'] = row[4].strip()
                    if len(row) > 5: row_data['landmark'] = row[5].strip()

                row_data['updated_at'] = datetime.now()
                if 'created_at' not in row_data or not row_data['created_at']:
                    row_data['created_at'] = datetime.now()

                # Build tuple
                vals = [row_data.get(col) for col in target_columns]
                final_data_raw.append(tuple(vals))

        log(f"Processed {len(final_data_raw)} rows. Deduplicating...")
        
        # 4. DEDUPLICATE
        unique_data = {}
        # Key columns for uniqueness: centre_code, ward_code, constituency_code, county_code
        u_cols = ['centre_code', 'ward_code', 'constituency_code', 'county_code']
        u_indices = [target_columns.index(c) for c in u_cols]
        
        duplicates = 0
        for row_tuple in final_data_raw:
            # Create a key, handling potential None/0 issues
            # We treat empty string as None if it's supposed to be null
            key_parts = []
            for idx in u_indices:
                val = row_tuple[idx]
                if val == "": val = None
                key_parts.append(val)
            key = tuple(key_parts)
            
            if key in unique_data:
                duplicates += 1
                continue
            unique_data[key] = row_tuple
        
        final_data = list(unique_data.values())
        log(f"  Deduplication complete: {duplicates} duplicates removed. {len(final_data)} unique rows remaining.")

        # 5. TRUNCATE AND INGEST
        log(f"Clearing {TARGET_TABLE} before fresh ingestion...")
        cur.execute(f"TRUNCATE TABLE {TARGET_TABLE} RESTART IDENTITY CASCADE;")
        
        cols_str = ",".join(target_columns)
        log(f"Ingesting into {TARGET_TABLE}...")
        query = f"INSERT INTO {TARGET_TABLE} ({cols_str}) VALUES %s"
        execute_values(cur, query, final_data)
        
        conn.commit()
        log(f"SUCCESS! Ingested {len(final_data)} rows into {TARGET_TABLE}.")
        
        cur.close()
        conn.close()
    except Exception as e:
        log(f"FATAL ERROR: {e}")
        import traceback
        log(traceback.format_exc())
        if 'conn' in locals():
            conn.rollback()

if __name__ == "__main__":
    run_smart_ingest()
