import os, psycopg2
from dotenv import load_dotenv

def the_fix():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    target_count = 24668
    print(f"=== THE DEFINITIVE FIX (v2) (Target: {target_count}) ===\n")
    
    # 1. Remap FKs
    print("[1/3] Remapping references...")
    cur.execute("""
        SELECT r.relname, a.attname
        FROM pg_constraint c
        JOIN pg_class r ON c.conrelid = r.oid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'f' AND c.confrelid = 'public.iebc_offices'::regclass;
    """)
    ref_tables = cur.fetchall()
    
    # We create a mapping table to avoid complex joins in UPDATE
    cur.execute("DROP TABLE IF EXISTS id_mapping;")
    cur.execute("""
        CREATE TABLE id_mapping AS 
        SELECT id as victim_id, 
               FIRST_VALUE(id) OVER(PARTITION BY ward_code, centre_code ORDER BY (latitude IS NOT NULL)::int DESC, id ASC) as keeper_id
        FROM public.iebc_offices
        WHERE ward_code IS NOT NULL AND centre_code IS NOT NULL;
    """)
    
    for table, col in ref_tables:
        cur.execute(f"UPDATE {table} t SET {col} = m.keeper_id FROM id_mapping m WHERE t.{col} = m.victim_id AND m.victim_id != m.keeper_id;")
        print(f"    Remapped {cur.rowcount} refs in {table}.{col}")

    # 2. Prune duplicates
    print("[2/3] Pruning surplus...")
    cur.execute("DELETE FROM public.iebc_offices WHERE id NOT IN (SELECT DISTINCT keeper_id FROM id_mapping);")
    print(f"      Pruned {cur.rowcount} duplicates.")

    # 3. Prune to exact count if needed
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    count = cur.fetchone()[0]
    if count > target_count:
        surplus = count - target_count
        print(f"      Pruning {surplus} high-code-count outliers...")
        cur.execute("""
            DELETE FROM public.iebc_offices
            WHERE id IN (
                SELECT id FROM public.iebc_offices
                ORDER BY (latitude IS NOT NULL)::int ASC, id DESC
                LIMIT %s
            )
        """, (surplus,))
    
    cur.execute("SELECT COUNT(*), COUNT(DISTINCT ward_code) FROM public.iebc_offices")
    final_count, wards = cur.fetchone()
    print(f"\nFINAL DATABASE COUNT: {final_count}")
    print(f"TOTAL WARDS: {wards}")
    
    conn.close()

if __name__ == "__main__": the_fix()
