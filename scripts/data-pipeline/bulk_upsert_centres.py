import pandas as pd
import requests
from dotenv import load_dotenv
import os
import math
import time
import re

load_dotenv()

def bulk_upsert(batch):
    url = f"{os.getenv('SUPABASE_URL')}/rest/v1/iebc_offices"
    headers = {
        'apikey': os.getenv('SUPABASE_ANON_KEY'),
        'Authorization': f"Bearer {os.getenv('SUPABASE_ANON_KEY')}",
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
    }
    # Exact column names for the unique constraint
    params = {'on_conflict': 'centre_code,ward_code,constituency_code,county_code'}
    response = requests.post(url, headers=headers, json=batch, params=params)
    if response.status_code not in [200, 201]:
        print(f"Error: {response.status_code} - {response.text}")
    return response.status_code in [200, 201]

def clean_code(val, length):
    if pd.isna(val) or str(val).strip() == "":
        return None
    s = str(val).strip()
    if '\n' in s: s = s.split('\n')[0].strip()
    digits = re.sub(r'\D', '', s)
    return digits.zfill(length) if digits else None

def parse_squashed_row(text):
    if not text or pd.isna(text): return None
    text = str(text).strip()
    # Pattern for squashed rows: 001MOMBASA 001CHANGAMWE 0001PORT REITZ 001BOMU PRIMARY SCHOOL
    pattern = r'^(\d{3})\s*([A-Z\s\-\']+)\s+(\d{3})\s*([A-Z\s\-\']+)\s+(\d{4})\s*([A-Z\s\-\']+)\s+(\d{3})\s*(.+)$'
    match = re.match(pattern, text)
    if match:
        return {
            'county_code': match.group(1),
            'county': match.group(2).strip(),
            'constituency_code': int(match.group(3)),
            'constituency_name': match.group(4).strip(),
            'ward_code': match.group(5),
            'ward': match.group(6).strip(),
            'centre_code': match.group(7),
            'office_location': match.group(8).strip()
        }
    return None

def main():
    print("Loading data...")
    df_raw = pd.read_csv('data/processed/raw_iebc_offices.csv')
    
    geo_lookup = {}
    if os.path.exists('data/processed/geocoded_iebc_offices.csv'):
        try:
            df_geo = pd.read_csv('data/processed/geocoded_iebc_offices.csv').drop_duplicates(['office_location', 'constituency'])
            df_geo['office_location'] = df_geo['office_location'].str.strip().str.upper()
            df_geo['constituency'] = df_geo['constituency'].str.strip().str.upper()
            geo_lookup = df_geo.set_index(['office_location', 'constituency']).to_dict('index')
        except Exception as e:
            print(f"Geo lookup error: {e}")

    df_wards = pd.read_csv('data/processed/ward_centroids_temp.csv')
    df_wards['ward_name'] = df_wards['ward_name'].str.strip().str.upper()
    df_wards['constituency'] = df_wards['constituency'].str.strip().str.upper()
    ward_lookup = df_wards.set_index(['ward_name', 'constituency']).to_dict('index')

    final_offices_dict = {}
    
    print(f"Processing {len(df_raw)} records...")
    
    for _, row in df_raw.iterrows():
        data = None
        
        # 1. Try parsing squashed columns first
        for col in df_raw.columns:
            res = parse_squashed_row(row[col])
            if res:
                data = res
                data['county_code'] = str(data['county_code']).zfill(3)
                data['ward_code'] = str(data['ward_code']).zfill(4)
                data['centre_code'] = str(data['centre_code']).zfill(3)
                break
        
        # 2. Try standard columns
        if not data and row.get('office_type') == 'REGISTRATION_CENTRE':
            cou_code = clean_code(row['county_code'], 3)
            con_code = clean_code(row['constituency_code'], 3)
            cen_code = clean_code(row['centre_code'], 3)
            if cou_code and con_code and cen_code:
                data = {
                    'county': str(row['county']).strip().upper(),
                    'constituency_name': str(row['constituency_name']).strip().upper(),
                    'constituency_code': int(con_code),
                    'county_code': cou_code,
                    'ward': str(row['ward']).strip().upper(),
                    'ward_code': clean_code(row['ward_code'], 4) or "0000",
                    'centre_code': cen_code,
                    'office_location': str(row['office_location']).strip().upper()
                }

        if not data: continue
            
        unique_key = (data['centre_code'], data['ward_code'], data['constituency_code'], data['county_code'])
        
        office = {
            'county': data['county'].upper(),
            'constituency': data['constituency_name'].upper(),
            'constituency_name': data['constituency_name'].upper(),
            'constituency_code': int(data['constituency_code']),
            'office_location': data['office_location'].upper(),
            'ward': data['ward'].upper(),
            'centre_code': data['centre_code'],
            'ward_code': data['ward_code'],
            'county_code': data['county_code'],
            'office_type': 'REGISTRATION_CENTRE',
            'category': 'registration_centre',
            'verified': False,
            'geocode_verified': False
        }

        lookup_key = (office['office_location'], office['constituency_name'])
        if lookup_key in geo_lookup:
            geo_data = geo_lookup[lookup_key]
            if not pd.isna(geo_data.get('latitude')):
                office['latitude'] = float(geo_data['latitude'])
                office['longitude'] = float(geo_data['longitude'])
                office['geocode_method'] = geo_data.get('geocode_method', 'local_shapefile')
                office['multi_source_confidence'] = float(geo_data.get('confidence', 0.8))
                office['geocode_verified'] = True
        
        if 'latitude' not in office:
            ward_key = (office['ward'], office['constituency_name'])
            if ward_key in ward_lookup:
                w_data = ward_lookup[ward_key]
                if not pd.isna(w_data.get('latitude')):
                    office['latitude'] = float(w_data['latitude'])
                    office['longitude'] = float(w_data['longitude'])
                    office['geocode_method'] = 'ward_centroid'
                    office['multi_source_confidence'] = 0.5
            else: continue

        if unique_key not in final_offices_dict:
            final_offices_dict[unique_key] = office

    final_offices = list(final_offices_dict.values())
    print(f"Prepared {len(final_offices)} unique offices for upsert.")
    
    batch_size = 500
    for i in range(0, len(final_offices), batch_size):
        batch = final_offices[i:i+batch_size]
        success = bulk_upsert(batch)
        if success:
            print(f"Upserted batch {i//batch_size + 1}/{math.ceil(len(final_offices)/batch_size)}")
        else:
            print(f"Failed batch {i//batch_size + 1}")
        time.sleep(0.1)

if __name__ == "__main__":
    main()
