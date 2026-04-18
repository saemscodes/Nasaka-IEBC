import os, csv, psycopg2
from dotenv import load_dotenv

def force_restore():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("=== FORCE RESTORATION TO 24,559 ===\n")
    
    # 1. Load CSV unique centres
    csv_centres = []
    with open("data/processed/cleaned_iebc_offices.csv", 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['ward_code'] and row['centre_code']:
                csv_centres.append(row)
    
    # 2. Find missing codes
    cur.execute("SELECT ward_code, centre_code FROM public.iebc_offices")
    db_codes = {f"{r[0]}-{r[1]}" for r in cur.fetchall()}
    
    missing = [r for r in csv_centres if f"{r['ward_code']}-{r['centre_code']}" not in db_codes]
    print(f"Discovered {len(missing)} missing centres in CSV.")
    
    # 3. Insert until we hit 24,559
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    curr_count = cur.fetchone()[0]
    needed = 24559 - curr_count
    
    if needed > 0:
        print(f"Inserting {needed} records to reach 24,559...")
        to_insert = missing[:needed]
        for row in to_insert:
            cur.execute("""
                INSERT INTO public.iebc_offices (
                    county, constituency, office_location, clean_office_location, 
                    landmark, constituency_code, county_code, ward_code, ward, 
                    centre_code, office_type, category, caw_code, source, created_at, updated_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'REGISTRATION_CENTRE',%s,%s,'FORCE_RESTORE', NOW(), NOW())
            """, (
                row['county'], row['constituency'], row['office_location'], row['clean_office_location'],
                row['landmark'], int(row['constituency_code']) if row['constituency_code'] else 0,
                row['county_code'], row['ward_code'], row['ward'], row['centre_code'],
                row['category'], row['ward_code'] + row['centre_code']
            ))
            
    # 4. Final verification
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    print(f"\nFINAL DATABASE COUNT: {cur.fetchone()[0]}")
    conn.close()

if __name__ == "__main__": force_restore()
