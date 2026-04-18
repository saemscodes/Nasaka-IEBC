import os, psycopg2
from dotenv import load_dotenv

def db_sync():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("=== DATABASE-NATIVE PERFECT SYNC (Target: 24,369) ===\n")
    
    # 1. Prune iebc_offices to match public.iebc_registration_centres
    # We match by Name + Ward (Lowered and Trimmed)
    cur.execute("""
        DELETE FROM public.iebc_offices
        WHERE id IN (
            SELECT t.id
            FROM public.iebc_offices t
            LEFT JOIN public.iebc_registration_centres r ON 
                LOWER(TRIM(t.office_location)) = LOWER(TRIM(r.name))
                AND LOWER(TRIM(t.ward)) = LOWER(TRIM(r.ward))
            WHERE r.id IS NULL
        )
    """)
    print(f"      Pruned {cur.rowcount} records not found in reference table.")

    # 2. Check for Internal Duplicates (Ensuring 1 record per reference entry)
    cur.execute("""
        WITH dups AS (
            SELECT id, ROW_NUMBER() OVER(PARTITION BY LOWER(TRIM(office_location)), LOWER(TRIM(ward)) ORDER BY latitude DESC NULLS LAST, updated_at DESC) as rnk
            FROM public.iebc_offices
        )
        DELETE FROM public.iebc_offices WHERE id IN (SELECT id FROM dups WHERE rnk > 1);
    """)
    print(f"      Deduplicated {cur.rowcount} internal overlaps.")

    # 3. Final Count Verification
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    count = cur.fetchone()[0]
    print(f"\nFINAL DATABASE COUNT: {count} (Target: 24,369)")
    
    conn.close()

if __name__ == "__main__": db_sync()
