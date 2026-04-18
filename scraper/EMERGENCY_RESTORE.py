import os, csv, psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

def emergency_restore():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("=== EMERGENCY DATA RESTORATION (v2) ===\n")
    
    # 1. Load CSV
    csv_centres = []
    with open("data/processed/cleaned_iebc_offices.csv", 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        added_codes = set()
        for row in reader:
            w_code = row['ward_code'].strip().split('\n')[0] if row['ward_code'] else ''
            c_code = row['centre_code'].strip().split('\n')[0] if row['centre_code'] else ''
            if not w_code or not c_code: continue
            code = f"{w_code}-{c_code}"
            if code in added_codes: continue
            
            row['ward_code'] = w_code
            row['centre_code'] = c_code
            csv_centres.append(row)
            added_codes.add(code)
            if len(csv_centres) >= 24668: break
            
    print(f"Loaded {len(csv_centres)} from CSV.")

    # 2. Get DB codes
    cur.execute("SELECT ward_code, centre_code FROM public.iebc_offices")
    db_codes = {f"{r[0]}-{r[1]}" for r in cur.fetchall()}
    
    missing = [r for r in csv_centres if f"{r['ward_code']}-{r['centre_code']}" not in db_codes]
    print(f"Restoring {len(missing)} missing centres...")

    if missing:
        to_insert = []
        for row in missing:
            const_code_raw = row['constituency_code'].strip().split('\n')[0] if row['constituency_code'] else '0'
            try: const_code = int(const_code_raw)
            except: const_code = 0
                
            to_insert.append((
                row['county'], row['constituency'], row['office_location'], row['clean_office_location'],
                row['landmark'], const_code,
                row['county_code'], row['ward_code'], row['ward'], row['centre_code'],
                'REGISTRATION_CENTRE', row['category'], row['ward_code'] + row['centre_code'], 
                'EMERGENCY_RESTORE', 'NOW()', 'NOW()'
            ))
            
        # Proper execute_values usage: The template should correspond to one tuple and NOT have 'VALUES'
        sql = """
            INSERT INTO public.iebc_offices (
                county, constituency, office_location, clean_office_location, 
                landmark, constituency_code, county_code, ward_code, ward, 
                centre_code, office_type, category, caw_code, source, created_at, updated_at
            ) VALUES %s
        """
        execute_values(cur, sql, to_insert)
        print(f"      Restored {len(to_insert)} records.")

    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    print(f"\nFINAL DATABASE COUNT: {cur.fetchone()[0]}")
    conn.close()

if __name__ == "__main__": emergency_restore()
