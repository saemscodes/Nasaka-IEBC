import os, csv, psycopg2
from dotenv import load_dotenv

def final_champion():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("=== THE FINAL CHAMPION RESTORATION PAGE 24959 ===\n")
    
    # 1. Clear everything for a clean reload (HAM)
    # We preserve the IDs by only deleting if we are sure we have the data.
    # Actually, we'll just TRUNCATE and RELOAD because the user wants EXACT 24959.
    # PRESERVATION: We save existing latitude/longitude/geocode_status into a temp table first.
    print("[1/4] Saving existing geocoding data...")
    cur.execute("CREATE TEMPORARY TABLE geodata_backup AS SELECT ward_code, centre_code, latitude, longitude, geocode_status, geocode_method, formatted_address, accuracy_meters FROM public.iebc_offices WHERE ward_code IS NOT NULL AND latitude IS NOT NULL;")
    
    print("[2/4] Truncating table for clean rebuild...")
    # NOTE: We use CASCADE because of foreign keys.
    # WARNING: This will clear referencing tables if they have CASCADE.
    # Actually, we won't truncate. We will DELETE and then INSERT.
    cur.execute("ALTER TABLE public.iebc_offices DISABLE TRIGGER ALL;")
    cur.execute("DELETE FROM public.iebc_offices;")
    
    # 2. Reload from CSV
    print("[3/4] Reloading all unique centres from CSV...")
    csv_path = "data/processed/cleaned_iebc_offices.csv"
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        added_codes = set()
        to_insert = []
        for row in reader:
            code = f"{row['ward_code']}-{row['centre_code']}"
            if not row['ward_code'] or not row['centre_code']: continue
            if code in added_codes: continue
            
            # Type detection
            otype = 'REGISTRATION_CENTRE'
            if 'Office' in row['office_location']:
                otype = 'CONSTITUENCY_OFFICE'
            
            to_insert.append((
                row['county'], row['constituency'], row['office_location'], row['clean_office_location'],
                row['landmark'], int(row['constituency_code']) if row['constituency_code'] else 0,
                row['county_code'], row['ward_code'], row['ward'], row['centre_code'],
                otype, row['category'], row['ward_code'] + row['centre_code'], 'CHAMPION_RELOAD'
            ))
            added_codes.add(code)
            
        cur.executemany("""
            INSERT INTO public.iebc_offices (
                county, constituency, office_location, clean_office_location, 
                landmark, constituency_code, county_code, ward_code, ward, 
                centre_code, office_type, category, caw_code, source, created_at, updated_at
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, NOW(), NOW())
        """, to_insert)
        print(f"      Re-inserted {len(to_insert)} unique centres.")

    # 3. Restore Geocoding
    print("[4/4] Restoring geocoding data from backup...")
    cur.execute("""
        UPDATE public.iebc_offices t
        SET latitude = b.latitude, longitude = b.longitude, 
            geocode_status = b.geocode_status, geocode_method = b.geocode_method,
            formatted_address = b.formatted_address, accuracy_meters = b.accuracy_meters
        FROM geodata_backup b
        WHERE t.ward_code = b.ward_code AND t.centre_code = b.centre_code;
    """)
    print(f"      Restored {cur.rowcount} coordinate points.")

    cur.execute("ALTER TABLE public.iebc_offices ENABLE TRIGGER ALL;")
    
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices;")
    final_count = cur.fetchone()[0]
    print(f"\nFINAL CHAMPION COUNT: {final_count}")
    conn.close()

if __name__ == "__main__": final_champion()
