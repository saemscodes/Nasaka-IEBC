import os
import csv
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

def total_reload():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        
        print("=== TOTAL TURNOVER RELOAD — GOING HAM (v7) ===\n")
        
        # 1. Load CSV data into temp table
        print("[1/4] Loading source CSV data...")
        cur.execute("DROP TABLE IF EXISTS temp_source;")
        cur.execute("""
            CREATE TEMPORARY TABLE temp_source (
                county TEXT, constituency_name TEXT, constituency TEXT, office_location TEXT, 
                clean_office_location TEXT, landmark TEXT, constituency_code TEXT, 
                county_code TEXT, ward_code TEXT, ward TEXT, centre_code TEXT, 
                office_type TEXT, category TEXT, source TEXT, created_at TEXT
            );
        """)
        
        with open("data/processed/cleaned_iebc_offices.csv", 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader)
            rows = [r for r in reader if len(r) >= 11 and r[8] and r[8].isdigit()]
            execute_values(cur, "INSERT INTO temp_source VALUES %s", rows)
        print(f"      Loaded {len(rows)} records from CSV.")

        # 2. Insert Missing Records into iebc_offices
        print("[2/4] Inserting missing registration centres for 100% turnover...")
        cur.execute("""
            INSERT INTO public.iebc_offices (
                county, constituency, office_location, clean_office_location, 
                landmark, constituency_code, county_code, ward_code, ward, 
                centre_code, office_type, category, caw_code, source, created_at, updated_at
            )
            SELECT 
                s.county, s.constituency, s.office_location, s.clean_office_location, 
                s.landmark, s.constituency_code::integer, s.county_code, s.ward_code, s.ward, 
                s.centre_code, s.office_type, s.category, s.ward_code || s.centre_code, 
                'NASAKA Recovery Import', NOW(), NOW()
            FROM temp_source s
            LEFT JOIN public.iebc_offices t ON 
                t.centre_code = s.centre_code 
                AND t.ward_code = s.ward_code 
                AND t.constituency_code = s.constituency_code::integer
                AND t.county_code = s.county_code
            WHERE t.id IS NULL;
        """)
        print(f"      Inserted {cur.rowcount} missing registration centres.")

        # 3. Final Code Backfill for existing ones
        print("[3/4] Finalizing administrative codes for any remaining orphans...")
        cur.execute("""
            UPDATE public.iebc_offices t
            SET ward_code = s.ward_code, centre_code = s.centre_code, 
                caw_code = s.ward_code || s.centre_code, updated_at = NOW()
            FROM temp_source s
            WHERE LOWER(TRIM(t.office_location)) = LOWER(TRIM(s.office_location))
              AND LOWER(TRIM(t.constituency)) = LOWER(TRIM(s.constituency))
              AND t.office_type = 'REGISTRATION_CENTRE'
              AND t.ward_code IS NULL;
        """)
        print(f"      Updated {cur.rowcount} existing records.")

        # 4. Final Audit
        cur.execute("SELECT COUNT(*), COUNT(DISTINCT ward_code) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' AND ward_code IS NOT NULL;")
        total, wards = cur.fetchone()
        print(f"\n=== FINAL TURNOVER AUDIT ===\n  Total Centres: {total:,}\n  Total Wards:   {wards:,}\n")
        
    except Exception as e:
        print(f"[RELOAD ERR] {e}")
        import traceback; traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__": total_reload()
