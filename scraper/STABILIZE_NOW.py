import os, csv, psycopg2
from dotenv import load_dotenv

def stabilize():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    target_count = 24668
    print(f"=== DATABASE STABILIZATION (Target: {target_count}) ===\n")
    
    # 1. Check current count
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    count = cur.fetchone()[0]
    print(f"Current Count: {count}")

    # 2. Add missing if below target
    if count < target_count:
        needed = target_count - count
        print(f"Restoring {needed} records...")
        csv_path = "data/processed/cleaned_iebc_offices.csv"
        cur.execute("SELECT ward_code, centre_code FROM public.iebc_offices")
        db_codes = {f"{r[0]}-{r[1]}" for r in cur.fetchall()}
        
        missing = []
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
                    'REGISTRATION_CENTRE', row['category'], row['ward_code'] + row['centre_code'], 'STABILIZE'
                ))
            
            sql = """
                INSERT INTO public.iebc_offices (
                    county, constituency, office_location, clean_office_location, 
                    landmark, constituency_code, county_code, ward_code, ward, 
                    centre_code, office_type, category, caw_code, source, created_at, updated_at
                ) VALUES %s
            """
            execute_values(cur, sql, to_insert)
    
    elif count > target_count:
        surplus = count - target_count
        print(f"Pruning {surplus} records...")
        cur.execute("DELETE FROM public.iebc_offices WHERE id IN (SELECT id FROM public.iebc_offices ORDER BY id DESC LIMIT %s)", (surplus,))

    # FINAL CHECK
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    final_count = cur.fetchone()[0]
    print(f"\nSTABILIZED COUNT: {final_count}")
    
    conn.close()

if __name__ == "__main__": stabilize()
