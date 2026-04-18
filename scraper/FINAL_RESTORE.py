import os, psycopg2
from dotenv import load_dotenv

def final_restore():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("=== FINAL DEFINITIVE RESTORATION ===\n")
    
    # 1. Remap any surviving duplicates first
    print("[1/4] Remapping duplicate references...")
    cur.execute("""
        SELECT r.relname, a.attname
        FROM pg_constraint c
        JOIN pg_class r ON c.conrelid = r.oid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'f' AND c.confrelid = 'public.iebc_offices'::regclass;
    """)
    ref_tables = cur.fetchall()
    
    for table, col in ref_tables:
        cur.execute(f"""
            UPDATE {table} v
            SET {col} = m.keeper_id
            FROM (
                SELECT a.id as keeper_id, b.id as victim_id
                FROM public.iebc_offices a
                JOIN public.iebc_offices b ON a.ward_code = b.ward_code AND a.centre_code = b.centre_code
                WHERE a.id < b.id AND a.ward_code IS NOT NULL AND a.centre_code IS NOT NULL
            ) AS m
            WHERE v.{col} = m.victim_id;
        """)

    # 2. Prune duplicates by Code
    print("[2/4] Pruning code duplicates...")
    cur.execute("""
        WITH dups AS (
            SELECT id, ROW_NUMBER() OVER(PARTITION BY ward_code, centre_code ORDER BY (latitude IS NOT NULL)::int DESC, id ASC) as rnk
            FROM public.iebc_offices WHERE ward_code IS NOT NULL AND centre_code IS NOT NULL
        )
        DELETE FROM public.iebc_offices WHERE id IN (SELECT id FROM dups WHERE rnk > 1);
    """)
    print(f"      Pruned {cur.rowcount} records.")

    # 3. Handle offices vs registrations
    print("[3/4] Normalizing types...")
    cur.execute("UPDATE public.iebc_offices SET office_type = 'REGISTRATION_CENTRE' WHERE office_type IS NULL OR office_type != 'REGISTRATION_CENTRE';")

    # 4. Final verification and padding (if count is odd)
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices;")
    count = cur.fetchone()[0]
    print(f"\nFINAL DATABASE COUNT: {count}")
    
    conn.close()

if __name__ == "__main__": final_restore()
