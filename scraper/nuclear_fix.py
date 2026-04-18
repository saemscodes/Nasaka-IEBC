import os
import csv
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

def nuclear_fix():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        
        print("=== TRULY NUCLEAR ADMINISTRATIVE BACKFILL — GOING HAM (v6) ===\n")
        
        # 1. Lift Unique Constraint
        print("[1/7] Dropping unique constraint...")
        cur.execute("ALTER TABLE public.iebc_offices DROP CONSTRAINT IF EXISTS iebc_offices_centre_ward_const_county_key;")
        
        # 2. Setup Temp Data
        print("[2/7] Setup temp table and CSV load...")
        cur.execute("DROP TABLE IF EXISTS temp_admin_n;")
        cur.execute("CREATE TEMPORARY TABLE temp_admin_n (county TEXT, constituency_name TEXT, constituency TEXT, office_location TEXT, clean_office_location TEXT, landmark TEXT, constituency_code TEXT, county_code TEXT, ward_code TEXT, ward TEXT, centre_code TEXT, office_type TEXT, category TEXT, source TEXT, created_at TEXT);")
        with open("data/processed/cleaned_iebc_offices.csv", 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader); rows = [r for r in reader if len(r) >= 11 and r[8] and r[8].isdigit()]
            execute_values(cur, "INSERT INTO temp_admin_n VALUES %s", rows)
        print(f"      Loaded {len(rows)} records from CSV.")

        # 3. Update Passes
        print("[3/7] Multi-pass updates (Administrative backfill)...")
        # Pass 1: Exact Name Match
        cur.execute("""
            UPDATE public.iebc_offices t SET ward_code = b.ward_code, centre_code = b.centre_code, 
                county_code = b.county_code, constituency_code = b.constituency_code::integer,
                caw_code = b.ward_code || b.centre_code, updated_at = NOW()
            FROM temp_admin_n b
            WHERE LOWER(TRIM(t.office_location)) = LOWER(TRIM(b.office_location))
              AND LOWER(TRIM(t.constituency)) = LOWER(TRIM(b.constituency));
        """)
        print(f"      Pass 1 (Exact): {cur.rowcount} updated.")

        # Pass 2: Ward Overlap Match
        cur.execute("""
            UPDATE public.iebc_offices t SET ward_code = b.ward_code, centre_code = b.centre_code, 
                caw_code = b.ward_code || b.centre_code, updated_at = NOW()
            FROM (SELECT DISTINCT ON (ward, constituency) ward, constituency, ward_code, centre_code FROM temp_admin_n) b
            WHERE LOWER(TRIM(t.ward)) = LOWER(TRIM(b.ward))
              AND LOWER(TRIM(t.constituency)) = LOWER(TRIM(b.constituency)) AND t.ward_code IS NULL;
        """)
        print(f"      Pass 2 (Ward): {cur.rowcount} updated.")

        # 4. Batched Relational Remapping (THE FK FIX)
        print("[4/7] Batched relational remapping (FK Integrity Pass)...")
        # Get all referencing columns
        cur.execute("""
            SELECT r.relname, a.attname
            FROM pg_constraint c
            JOIN pg_class r ON c.conrelid = r.oid
            JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
            WHERE c.contype = 'f' AND c.confrelid = 'public.iebc_offices'::regclass;
        """)
        ref_tables = cur.fetchall()
        
        for table, col in ref_tables:
            print(f"      Remapping {table}.{col}...")
            cur.execute(f"""
                UPDATE {table} v
                SET {col} = keepers.keeper_id
                FROM (
                    SELECT DISTINCT ON (centre_code, ward_code, constituency_code, county_code)
                           id as keeper_id, centre_code, ward_code, constituency_code, county_code
                    FROM public.iebc_offices
                    WHERE ward_code IS NOT NULL AND centre_code IS NOT NULL
                    ORDER BY centre_code, ward_code, constituency_code, county_code, latitude DESC NULLS LAST, updated_at DESC
                ) AS keepers
                JOIN public.iebc_offices victims ON 
                    victims.centre_code = keepers.centre_code 
                    AND victims.ward_code = keepers.ward_code
                    AND victims.constituency_code = keepers.constituency_code
                    AND victims.county_code = keepers.county_code
                WHERE v.{col} = victims.id AND victims.id != keepers.keeper_id;
            """)
            print(f"      - {cur.rowcount} references shifted.")

        # 5. Prune Duplicates
        print("[5/7] Pruning redundant duplicates...")
        cur.execute("""
            WITH dups AS (
                SELECT id, ROW_NUMBER() OVER(PARTITION BY centre_code, ward_code, constituency_code, county_code ORDER BY latitude DESC NULLS LAST, updated_at DESC) as rnk
                FROM public.iebc_offices WHERE ward_code IS NOT NULL AND centre_code IS NOT NULL
            )
            DELETE FROM public.iebc_offices WHERE id IN (SELECT id FROM dups WHERE rnk > 1);
        """)
        print(f"      Pruned {cur.rowcount} redundant registration centres.")

        # 6. Restore Constraint
        print("[6/7] Restoring unique constraint...")
        cur.execute("ALTER TABLE public.iebc_offices ADD CONSTRAINT iebc_offices_centre_ward_const_county_key UNIQUE (centre_code, ward_code, constituency_code, county_code);")

        # 7. Audit
        cur.execute("SELECT COUNT(*), COUNT(*) FILTER (WHERE ward_code IS NOT NULL) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE';")
        total, has_code = cur.fetchone()
        print(f"\n=== NUCLEAR AUDIT COMPLETE ===\n  Total Centres: {total:,}\n  Complete:      {has_code:,} ({100*has_code/total:.1f}%)")
        
    except Exception as e:
        print(f"[NUCLEAR ERR] {e}")
        import traceback; traceback.print_exc()
    finally:
        conn.close()

if __name__ == "__main__": nuclear_fix()
