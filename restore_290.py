import json
import csv
import psycopg2
from psycopg2.extras import execute_values
import re
from datetime import datetime

def clean_name(name):
    if not name: return ""
    name = str(name).strip().upper()
    name = name.replace(" CITY", "").replace(" COUNTY", "")
    name = name.replace("-", " ").replace("/", " ").replace(" - ", " ")
    name = re.sub(r'\s+', ' ', name).strip()
    if name == "ELGEYO MARAKWET": name = "ELGEYO-MARAKWET"
    if name == "THARAKA NITHI": name = "THARAKA-NITHI"
    name = name.replace("'", "")
    return name

def restore_290():
    PASSWORD = "1268Saem'sTunes!"
    PROJECT_ID = "ftswzvqwxdwgkvfbwfpx"
    JSON_PATH = r'd:\CEKA\NASAKA\v005\public\iebc-offices.json'
    CSV_PATH = r'C:\Users\Administrator\Downloads\290 CONSTITUENCY IEBC OFFICES - FAIR ATTEMPT.csv'
    BACKUP_TABLE = "public.iebc_offices_backup_20260425"

    conn = psycopg2.connect(
        host="aws-0-eu-north-1.pooler.supabase.com", port=6543, user=f"postgres.{PROJECT_ID}",
        password=PASSWORD, dbname="postgres", sslmode='require'
    )
    cur = conn.cursor()

    # 1. LOAD BACKUP METADATA
    print("Loading backup metadata...")
    target_map = {
        'county': 'county',
        'constituency_name': 'constituency_name',
        'constituency_code': 'constituency_code',
        'county_code': 'county_code',
        'ward_code': 'ward_code',
        'centre_code': 'centre_code',
        'returning_officer_name': 'returning_officer_name',
        'returning_officer_email': 'returning_officer_email',
        'office_type': 'office_type',
        'category': 'category',
        'latitude': 'latitude',
        'longitude': 'longitude'
    }
    cur.execute(f"SELECT {', '.join(target_map.keys())} FROM {BACKUP_TABLE}")
    backup_rows = cur.fetchall()
    backup_lookup = {}
    for row in backup_rows:
        d = dict(zip(target_map.keys(), row))
        key = (clean_name(d['county']), clean_name(d['constituency_name']))
        if key not in backup_lookup or d.get('office_type') != 'REGISTRATION_CENTRE':
            backup_lookup[key] = d

    # 2. LOAD JSON RECORDS (PRIORITY FOR COORDINATES)
    print("Loading JSON records...")
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        json_data = json.load(f)
    json_consts = [d for d in json_data if d.get('ot') == 'CONSTITUENCY_OFFICE']
    json_lookup = {(clean_name(j.get('y')), clean_name(j.get('c'))): j for j in json_consts if j.get('y') and j.get('c')}

    # 3. LOAD CSV LOCATIONS
    print("Loading CSV locations...")
    csv_lookup = {}
    with open(CSV_PATH, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (clean_name(row.get('county')), clean_name(row.get('constituency_n')))
            csv_lookup[key] = row

    # 4. PREPARE 290 RECORDS (Union + Filtering)
    all_keys = set(backup_lookup.keys()) | set(json_lookup.keys()) | set(csv_lookup.keys())
    all_keys = sorted(list(all_keys))
    
    final_records = []
    NAIROBI_LAT, NAIROBI_LNG = -1.1488934, 36.9648429
    
    for key in all_keys:
        if not key[1] or key[1] == "NULL": continue
        
        b = backup_lookup.get(key, {})
        j = json_lookup.get(key, {})
        c = csv_lookup.get(key, {})
        
        # HIERARCHY OF COORDS: JSON > CSV > Backup
        lat, lng = None, None
        if j.get('lt') and j.get('lg'):
            lat, lng = j['lt'], j['lg']
        
        if not lat and c:
            wkt = c.get('WKT', '')
            m = re.search(r'POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)', wkt)
            if m:
                lng, lat = float(m.group(1)), float(m.group(2))
        
        # If still null or if it matches the Nairobi Cluster in backup, try to find better
        b_lat = b.get('latitude')
        b_lng = b.get('longitude')
        is_nairobi_cluster = False
        if b_lat is not None and b_lng is not None:
             if abs(b_lat - NAIROBI_LAT) < 0.0001 and abs(b_lng - NAIROBI_LNG) < 0.0001:
                 is_nairobi_cluster = True

        if is_nairobi_cluster:
            pass # Ignore backup coordinates
        elif not lat:
            lat, lng = b_lat, b_lng

        # Build record
        county_raw = b.get('county') or j.get('y') or c.get('county')
        constituency_raw = b.get('constituency_name') or j.get('c') or c.get('constituency_n')
        
        normalized_county = clean_name(county_raw)
        normalized_constituency = clean_name(constituency_raw)

        rec = {
            'county': normalized_county,
            'constituency': normalized_constituency,
            'constituency_name': normalized_constituency,
            'constituency_code': b.get('constituency_code') or c.get('constituency_code'),
            'county_code': b.get('county_code') or c.get('county_code'),
            'ward_code': b.get('ward_code') or c.get('ward_code'),
            'centre_code': b.get('centre_code') or c.get('centre_code'),
            'returning_officer_name': b.get('returning_officer_name'),
            'returning_officer_email': b.get('returning_officer_email'),
            'office_type': 'CONSTITUENCY_OFFICE',
            'category': 'office',
            'verified': True,
            'verified_at': datetime.now(),
            'source': 'RESTORATION_SCRIPT_V5_STRICT_COORDS',
            'office_location': c.get('office_location') or b.get('office_location') or j.get('n') or (b.get('constituency_name') or "Unknown") + " IEBC Office",
            'latitude': lat,
            'longitude': lng
        }
        
        if rec['latitude'] and rec['longitude']:
            final_records.append(rec)

    # 5. DEDUPLICATE AND TRIM TO 290
    print(f"Prepared {len(final_records)} records with spatial data.")
    # Sort by county, constituency for stability
    final_records.sort(key=lambda x: (x['county'], x['constituency']))
    
    # Prune any duplicates resulting from cleaning (e.g. ELGEYO-MARAKWET vs ELGEYO/MARAKWET)
    unique_final = []
    seen = set()
    for r in final_records:
        key = (clean_name(r['county']), clean_name(r['constituency']))
        if key not in seen:
            unique_final.append(r)
            seen.add(key)
    
    print(f"Unique records: {len(unique_final)}")
    if len(unique_final) > 290:
        unique_final = unique_final[:290]

    # 6. INSERT
    print(f"Inserting exactly {len(unique_final)} records...")
    cur.execute("TRUNCATE TABLE public.iebc_offices RESTART IDENTITY CASCADE;")
    if unique_final:
        cols = sorted(unique_final[0].keys())
        query = f"INSERT INTO public.iebc_offices ({', '.join(cols)}, geom) VALUES %s"
        values = []
        for r in unique_final:
            row = [r[c] for c in cols]
            lat, lng = r.get('latitude'), r.get('longitude')
            geom = f"SRID=4326;POINT({lng} {lat})" if lat and lng else None
            row.append(geom)
            values.append(tuple(row))
        execute_values(cur, query, values)

    conn.commit()
    print("Done!")
    cur.close()
    conn.close()

if __name__ == "__main__":
    restore_290()
