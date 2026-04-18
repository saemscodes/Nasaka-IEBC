import os, csv, psycopg2
from dotenv import load_dotenv

def restore_hardened():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    target_count = 24668
    print(f"=== HARDENED RESTORATION (Target: {target_count}) ===\n")
    
    # 1. Load all from CSV
    print("[1/3] Loading source data...")
    csv_centres = []
    with open("data/processed/cleaned_iebc_offices.csv", 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        added = set()
        for row in reader:
            w = row['ward_code'].strip().split('\n')[0] if row['ward_code'] else ''
            c = row['centre_code'].strip().split('\n')[0] if row['centre_code'] else ''
            if not w or not c: continue
            code = f"{w}-{c}"
            if code in added: continue
            row['ward_code'] = w
            row['centre_code'] = c
            csv_centres.append(row)
            added.add(code)
            if len(csv_centres) >= target_count: break

    # 2. Get existing codes
    cur.execute("SELECT ward_code, centre_code FROM public.iebc_offices")
    db_codes = {f"{r[0]}-{r[1]}" for r in cur.fetchall()}
    
    missing = [r for r in csv_centres if f"{r['ward_code']}-{r['centre_code']}" not in db_codes]
    print(f"Restoring {len(missing)} missing records sequentially...")

    # 3. Insert loop
    inserted = 0
    for row in missing:
        try:
            cur.execute("""
                INSERT INTO public.iebc_offices (
                    county, constituency, office_location, clean_office_location, 
                    landmark, constituency_code, county_code, ward_code, ward, 
                    centre_code, office_type, category, caw_code, source, created_at, updated_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'REGISTRATION_CENTRE',%s,%s,'HARDENED', NOW(), NOW())
                ON CONFLICT (ward_code, centre_code, constituency_code, county_code) DO NOTHING;
            """, (
                row['county'], row['constituency'], row['office_location'], row['clean_office_location'],
                row['landmark'], int(row['constituency_code'].strip().split('\n')[0]) if row['constituency_code'] else 0,
                row['county_code'], row['ward_code'], row['ward'], row['centre_code'],
                row['category'], row['ward_code'] + row['centre_code']
            ))
            if cur.rowcount > 0:
                inserted += 1
        except Exception as e:
            print(f"  Error inserting {row['office_location']}: {e}")
            continue

    print(f"      Restored {inserted} records.")
    
    # Final count check
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    print(f"\nFINAL DATABASE COUNT: {cur.fetchone()[0]}")
    conn.close()

if __name__ == "__main__": restore_hardened()
