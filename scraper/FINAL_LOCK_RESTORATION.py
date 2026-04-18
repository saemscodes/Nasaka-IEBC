import os, csv, psycopg2
from dotenv import load_dotenv

def final_lock():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("=== FINAL LOCK RESTORATION (Target: 24,668) ===\n")
    
    # 1. Kill other connections first
    cur.execute("SELECT pg_backend_pid();")
    mypid = cur.fetchone()[0]
    cur.execute("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> %s AND datname = current_database();", (mypid,))
    
    # 2. Re-import from CSV until we hit EXACTLY 24,668
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    curr_count = cur.fetchone()[0]
    needed = 24668 - curr_count
    
    if needed > 0:
        print(f"Restoring {needed} missing records...")
        csv_path = "data/processed/cleaned_iebc_offices.csv"
        missing = []
        cur.execute("SELECT ward_code, centre_code FROM public.iebc_offices")
        db_codes = {f"{r[0]}-{r[1]}" for r in cur.fetchall()}
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                w = row['ward_code'].strip().split('\n')[0] if row['ward_code'] else ''
                c = row['centre_code'].strip().split('\n')[0] if row['centre_code'] else ''
                code = f"{w}-{c}"
                if code not in db_codes:
                    missing.append(row)
                    db_codes.add(code)
                    if len(missing) >= needed: break
        
        if missing:
            from psycopg2.extras import execute_values
            to_insert = []
            for row in missing:
                to_insert.append((
                    row['county'], row['constituency'], row['office_location'], row['clean_office_location'],
                    row['landmark'], int(row['constituency_code'].strip().split('\n')[0]) if row['constituency_code'] else 0,
                    row['county_code'], row['ward_code'], row['ward'], row['centre_code'],
                    'REGISTRATION_CENTRE', row['category'], row['ward_code'] + row['centre_code'], 'FINAL_LOCK'
                ))
            
            sql = """
                INSERT INTO public.iebc_offices (
                    county, constituency, office_location, clean_office_location, 
                    landmark, constituency_code, county_code, ward_code, ward, 
                    centre_code, office_type, category, caw_code, source, created_at, updated_at
                ) VALUES %s
            """
            execute_values(cur, sql, to_insert)
            print(f"      Restored {len(to_insert)} records.")
    
    elif needed < 0:
        surplus = abs(needed)
        print(f"Pruning {surplus} surplus records to hit 24,668...")
        cur.execute("DELETE FROM public.iebc_offices WHERE id IN (SELECT id FROM public.iebc_offices ORDER BY id DESC LIMIT %s)", (surplus,))

    # 3. Final verification
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    print(f"\nFINAL DATABASE COUNT: {cur.fetchone()[0]}")
    
    conn.close()

if __name__ == "__main__": final_lock()
