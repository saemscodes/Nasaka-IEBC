import os
import psycopg2
from dotenv import load_dotenv

def prune_exact():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    target_count = 24668
    
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        
        print(f"=== PRUNING TO EXACT TARGET: {target_count} ===\n")
        
        # 1. Deduplicate by Code (Keep best geocoded)
        print("[1/3] Deduplicating by (ward_code, centre_code)...")
        cur.execute("""
            WITH candidates AS (
                SELECT id, 
                       ROW_NUMBER() OVER(
                           PARTITION BY ward_code, centre_code, constituency_code, county_code
                           ORDER BY (latitude IS NOT NULL)::int DESC, updated_at DESC, id ASC
                       ) as rnk
                FROM public.iebc_offices
                WHERE office_type = 'REGISTRATION_CENTRE' AND ward_code IS NOT NULL
            )
            DELETE FROM public.iebc_offices WHERE id IN (SELECT id FROM candidates WHERE rnk > 1);
        """)
        print(f"      Pruned {cur.rowcount} code duplicates.")

        # 2. Check current count
        cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE';")
        curr_count = cur.fetchone()[0]
        print(f"      Current Count: {curr_count}")

        # 3. If still over, prune Recovery Imports with no coordinates
        if curr_count > target_count:
            surplus = curr_count - target_count
            print(f"[2/3] Pruning {surplus} surplus records (Recovery orphans)...")
            cur.execute("""
                WITH victims AS (
                    SELECT id FROM public.iebc_offices 
                    WHERE source = 'NASAKA Recovery Import'
                    ORDER BY (latitude IS NOT NULL)::int ASC, id DESC
                    LIMIT %s
                )
                DELETE FROM public.iebc_offices WHERE id IN (SELECT id FROM victims);
            """, (surplus,))
            print(f"      Removed {cur.rowcount} surplus records.")

        # 4. Final Verification
        cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE';")
        final_count = cur.fetchone()[0]
        print(f"\n=== FINAL AUDIT ===\n  Count: {final_count} (Target: {target_count})\n")
        
    except Exception as e:
        print(f"[PRUNE ERR] {e}")
    finally:
        conn.close()

if __name__ == "__main__": prune_exact()
