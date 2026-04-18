import os
import csv
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from urllib.parse import urlparse

def backfill():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    
    # Connection diagnostics (preserving previous pattern)
    if db_url:
        parsed = urlparse(db_url)
        print(f"[BACKFILL] Connecting to {parsed.hostname}:{parsed.port or 6543}...")
    
    try:
        conn = psycopg2.connect(db_url, connect_timeout=10)
        conn.autocommit = False # Using transaction for safety
        cur = conn.cursor()
        
        print("=== ADMINISTRATIVE CSV BACKFILL — GO HAM MODE ===\n")
        
        # 1. Create temporary table
        print("[1/5] Creating temporary table...")
        cur.execute("""
            CREATE TEMPORARY TABLE temp_admin_backfill (
                county TEXT,
                constituency_name TEXT,
                constituency TEXT,
                office_location TEXT,
                clean_office_location TEXT,
                landmark TEXT,
                constituency_code TEXT,
                county_code TEXT,
                ward_code TEXT,
                ward TEXT,
                centre_code TEXT,
                office_type TEXT,
                category TEXT,
                source TEXT,
                created_at TEXT
            ) ON COMMIT DROP;
        """)
        
        # 2. Load CSV data
        csv_path = "data/processed/cleaned_iebc_offices.csv"
        print(f"[2/5] Loading data from {csv_path}...")
        
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            headers = next(reader) # skip headers
            rows = []
            for row in reader:
                # Filter out junk rows (page headers/etc)
                if len(row) >= 11 and row[8] and row[8].isdigit(): # ward_code must be numeric
                    rows.append(row)
            
            execute_values(cur, """
                INSERT INTO temp_admin_backfill (
                    county, constituency_name, constituency, office_location, 
                    clean_office_location, landmark, constituency_code, 
                    county_code, ward_code, ward, centre_code, office_type, 
                    category, source, created_at
                ) VALUES %s
            """, rows)
            print(f"      Loaded {len(rows)} records into temp table.")

        # 3. Pass 0: Nuclear Dedup (RE-HAMMED)
        # Remove any rows in iebc_offices that are duplicates by physical location
        # This prevents the UNIQUE constraint violation during update.
        print("[3/9] Step 0: Nuclear deduplication (Cleaning existing collisions)...")
        cur.execute("""
            WITH dups AS (
                SELECT id, 
                       ROW_NUMBER() OVER(
                           PARTITION BY LOWER(TRIM(office_location)), LOWER(TRIM(constituency)), LOWER(TRIM(county))
                           ORDER BY ward_code DESC NULLS LAST, centre_code DESC NULLS LAST, id ASC
                       ) as rnk
                FROM public.iebc_offices
                WHERE office_type = 'REGISTRATION_CENTRE'
            )
            DELETE FROM public.iebc_offices
            WHERE id IN (SELECT id FROM dups WHERE rnk > 1);
        """)
        print(f"      Pruned {cur.rowcount} physical duplicate records.")

        # 4. Pass 1: Direct exact join (location + constituency + county)
        print("[4/9] Pass 1: Direct exact join (location + constituency + county)...")
        cur.execute("""
            WITH matched AS (
                SELECT t.id, b.ward_code, b.centre_code, b.ward, b.county_code, 
                       b.constituency_code, b.clean_office_location, b.landmark, 
                       b.category,
                       ROW_NUMBER() OVER(PARTITION BY b.centre_code, b.ward_code, b.constituency_code, b.county_code ORDER BY t.id) as rnk
                FROM public.iebc_offices t
                JOIN temp_admin_backfill b ON 
                    LOWER(TRIM(t.office_location)) = LOWER(TRIM(b.office_location))
                    AND LOWER(TRIM(t.constituency)) = LOWER(TRIM(b.constituency))
                    AND LOWER(TRIM(t.county)) = LOWER(TRIM(b.county))
                WHERE t.office_type = 'REGISTRATION_CENTRE'
                  AND t.ward_code IS NULL
            )
            UPDATE public.iebc_offices t
            SET 
                ward_code = m.ward_code,
                centre_code = m.centre_code,
                caw_code = m.ward_code || m.centre_code,
                ward = COALESCE(t.ward, m.ward),
                county_code = COALESCE(t.county_code, m.county_code),
                constituency_code = m.constituency_code::integer,
                clean_office_location = COALESCE(t.clean_office_location, m.clean_office_location),
                landmark = COALESCE(t.landmark, m.landmark),
                category = COALESCE(t.category, m.category),
                updated_at = NOW()
            FROM matched m
            WHERE t.id = m.id AND m.rnk = 1;
        """)
        print(f"      Updated {cur.rowcount} records.")

        # 5. Pass 2: Exact Ward + Constituency match
        print("[5/9] Pass 2: Exact Ward + Constituency match...")
        cur.execute("""
            WITH matched AS (
                SELECT t.id, b.ward_code, b.centre_code,
                       ROW_NUMBER() OVER(PARTITION BY b.centre_code, b.ward_code, t.constituency_code, t.county_code ORDER BY t.id) as rnk
                FROM public.iebc_offices t
                JOIN (
                    SELECT DISTINCT ON (ward, constituency) 
                        ward, constituency, ward_code, centre_code 
                    FROM temp_admin_backfill
                    WHERE ward_code IS NOT NULL
                ) b ON 
                    LOWER(TRIM(t.ward)) = LOWER(TRIM(b.ward))
                    AND LOWER(TRIM(t.constituency)) = LOWER(TRIM(b.constituency))
                WHERE t.office_type = 'REGISTRATION_CENTRE'
                  AND t.ward_code IS NULL
            )
            UPDATE public.iebc_offices t
            SET 
                ward_code = m.ward_code,
                centre_code = m.centre_code,
                caw_code = m.ward_code || m.centre_code,
                updated_at = NOW()
            FROM matched m
            WHERE t.id = m.id AND m.rnk = 1;
        """)
        print(f"      Updated {cur.rowcount} records via Ward overlap.")

        # 6. Pass 3: Fuzzy Ward match
        print("[6/9] Pass 3: Fuzzy Ward match (pg_trgm)...")
        try:
            cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
            cur.execute("""
                WITH matched AS (
                    SELECT t.id, b.ward_code,
                           ROW_NUMBER() OVER(PARTITION BY t.centre_code, b.ward_code, t.constituency_code, t.county_code ORDER BY t.id) as rnk
                    FROM public.iebc_offices t
                    JOIN (
                        SELECT DISTINCT ON (constituency, ward)
                            constituency, ward, ward_code
                        FROM temp_admin_backfill
                        WHERE ward_code IS NOT NULL
                    ) b ON LOWER(TRIM(t.constituency)) = LOWER(TRIM(b.constituency))
                    WHERE similarity(LOWER(TRIM(t.ward)), LOWER(TRIM(b.ward))) > 0.6
                      AND t.office_type = 'REGISTRATION_CENTRE'
                      AND t.ward_code IS NULL
                )
                UPDATE public.iebc_offices t
                SET ward_code = m.ward_code,
                    caw_code = m.ward_code || COALESCE(t.centre_code, '999'),
                    updated_at = NOW()
                FROM matched m
                WHERE t.id = m.id AND m.rnk = 1;
            """)
            print(f"      Updated {cur.rowcount} records via fuzzy Ward logic.")
        except Exception as fe:
            print(f"      Skip fuzzy pass: {fe}")

        # 7. Pass 4: Fuzzy Office Location match
        print("[7/9] Pass 4: Fuzzy Office Location match (HAM mode)...")
        cur.execute("""
            WITH matched AS (
                SELECT t.id, b.ward_code, b.centre_code,
                       ROW_NUMBER() OVER(PARTITION BY b.centre_code, b.ward_code, t.constituency_code, t.county_code ORDER BY t.id) as rnk
                FROM public.iebc_offices t
                JOIN temp_admin_backfill b ON 
                    LOWER(TRIM(t.constituency)) = LOWER(TRIM(b.constituency))
                    AND similarity(LOWER(TRIM(t.office_location)), LOWER(TRIM(b.office_location))) > 0.7
                WHERE t.office_type = 'REGISTRATION_CENTRE'
                  AND t.ward_code IS NULL
            )
            UPDATE public.iebc_offices t
            SET ward_code = m.ward_code,
                centre_code = m.centre_code,
                caw_code = m.ward_code || m.centre_code,
                updated_at = NOW()
            FROM matched m
            WHERE t.id = m.id AND m.rnk = 1;
        """)
        print(f"      Updated {cur.rowcount} records via fuzzy office location.")

        # 8. Cleanup Final Collisions (Safety net)
        print("[8/9] Step 8: Post-backfill cleanup (Resolving remaining code collisions)...")
        cur.execute("""
            WITH dups AS (
                SELECT id, 
                       ROW_NUMBER() OVER(
                           PARTITION BY centre_code, ward_code, constituency_code, county_code
                           ORDER BY updated_at DESC, id ASC
                       ) as rnk
                FROM public.iebc_offices
                WHERE ward_code IS NOT NULL AND centre_code IS NOT NULL
            )
            DELETE FROM public.iebc_offices
            WHERE id IN (SELECT id FROM dups WHERE rnk > 1);
        """)
        print(f"      Merged {cur.rowcount} final code-level duplicates.")

        # 9. Audit
        print("[9/9] Finalizing codes and auditing...")
        cur.execute("""
            UPDATE public.iebc_offices
            SET caw_code = ward_code || COALESCE(centre_code, '999'),
                updated_at = NOW()
            WHERE ward_code IS NOT NULL 
              AND caw_code IS NULL;
        """)
        
        conn.commit()
        cur.execute("""
            UPDATE public.iebc_offices
            SET caw_code = ward_code || COALESCE(centre_code, '999'),
                updated_at = NOW()
            WHERE ward_code IS NOT NULL 
              AND caw_code IS NULL;
        """)
        
        conn.commit()
        
        cur.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE ward_code IS NOT NULL) as has_ward_code,
                COUNT(*) FILTER (WHERE centre_code IS NOT NULL) as has_centre_code,
                COUNT(*) FILTER (WHERE caw_code IS NOT NULL) as has_caw_code
            FROM public.iebc_offices
            WHERE office_type = 'REGISTRATION_CENTRE';
        """)
        res = cur.fetchone()
        print(f"\n=== FINAL ADMINISTRATIVE AUDIT ===")
        print(f"  Total Centres:    {res[0]:,}")
        print(f"  ward_code:        {res[1]:,} ({100*res[1]/res[0]:.1f}%)")
        print(f"  centre_code:      {res[2]:,} ({100*res[2]/res[0]:.1f}%)")
        print(f"  caw_code:         {res[3]:,} ({100*res[3]/res[0]:.1f}%)")
        
        if res[1] < res[0]:
            print(f"\nWARNING: {res[0] - res[1]} records still missing ward_code.")
            print("These will be exported for HITL inspection.")
            
    except Exception as e:
        print(f"[BACKFILL ERROR] {e}")
        import traceback
        traceback.print_exc()
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    backfill()
