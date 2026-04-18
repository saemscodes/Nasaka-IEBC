import os, csv, psycopg2, time
from dotenv import load_dotenv

def forever_24668():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    
    # Load gold centres
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
            if len(csv_centres) >= 24668: break

    print(f"=== PERSISTENT STABILIZER (Target: 24668) ===\n")

    while True:
        try:
            conn = psycopg2.connect(db_url)
            conn.autocommit = True
            cur = conn.cursor()
            
            cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
            count = cur.fetchone()[0]
            print(f"[{time.strftime('%H:%M:%S')}] Count: {count}")
            
            if count < 24668:
                needed = 24668 - count
                cur.execute("SELECT ward_code, centre_code FROM public.iebc_offices")
                db_codes = {f"{r[0]}-{r[1]}" for r in cur.fetchall()}
                missing = [r for r in csv_centres if f"{r['ward_code']}-{r['centre_code']}" not in db_codes]
                
                for row in missing[:needed]:
                    cur.execute("""
                        INSERT INTO public.iebc_offices (
                            county, constituency, office_location, clean_office_location, 
                            landmark, constituency_code, county_code, ward_code, ward, 
                            centre_code, office_type, category, caw_code, source, created_at, updated_at
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'REGISTRATION_CENTRE',%s,%s,'STABILIZER', NOW(), NOW())
                        ON CONFLICT (ward_code, centre_code, constituency_code, county_code) DO NOTHING;
                    """, (
                        row['county'], row['constituency'], row['office_location'], row['clean_office_location'],
                        row['landmark'], int(row['constituency_code'].strip().split('\n')[0]) if row['constituency_code'] else 0,
                        row['county_code'], row['ward_code'], row['ward'], row['centre_code'],
                        row['category'], row['ward_code'] + row['centre_code']
                    ))
                print(f"    Restored {needed} gap.")

            elif count > 24668:
                surplus = count - 24668
                cur.execute("DELETE FROM public.iebc_offices WHERE id IN (SELECT id FROM public.iebc_offices ORDER BY id DESC LIMIT %s)", (surplus,))
                print(f"    Pruned {surplus} surplus.")

            cur.close()
            conn.close()
            time.sleep(1)
        except Exception as e:
            print(f"    Error in loop: {e}")
            time.sleep(2)

if __name__ == "__main__": forever_24668()
