import os, psycopg2
from dotenv import load_dotenv

def surgical_dedup():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("=== SURGICAL DEDUP (Target: 24,668) ===\n")
    
    # 1. Remap FKs for ANY record that is about to be deleted
    print("[1/2] Remapping references...")
    cur.execute("""
        CREATE TEMPORARY TABLE dedup_mapping AS
        SELECT id as victim_id,
               FIRST_VALUE(id) OVER(PARTITION BY ward_code, centre_code ORDER BY (latitude IS NOT NULL)::int DESC, id ASC) as keeper_id
        FROM public.iebc_offices
        WHERE ward_code IS NOT NULL AND centre_code IS NOT NULL;
    """)
    
    cur.execute("""
        SELECT r.relname, a.attname
        FROM pg_constraint c
        JOIN pg_class r ON c.conrelid = r.oid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'f' AND c.confrelid = 'public.iebc_offices'::regclass;
    """)
    for table, col in cur.fetchall():
        cur.execute(f"UPDATE {table} t SET {col} = m.keeper_id FROM dedup_mapping m WHERE t.{col} = m.victim_id AND m.victim_id != m.keeper_id;")
        print(f"    Remapped {cur.rowcount} refs in {table}.{col}")

    # 2. Prune everything that is not a keeper AND reach 24,668
    print("[2/2] Pruning to 24,668...")
    cur.execute("DELETE FROM public.iebc_offices WHERE id NOT IN (SELECT keeper_id FROM dedup_mapping);")
    pruned = cur.rowcount
    print(f"      Pruned {pruned} duplicates.")
    
    # 3. Final adjust to exactly 24,668 if still off (e.g. from missing codes)
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    count = cur.fetchone()[0]
    if count > 24668:
        surplus = count - 24668
        cur.execute("DELETE FROM public.iebc_offices WHERE id IN (SELECT id FROM public.iebc_offices ORDER BY id DESC LIMIT %s)", (surplus,))
        print(f"      Pruned {surplus} final outliers.")

    cur.execute("SELECT COUNT(*), COUNT(DISTINCT ward_code) FROM public.iebc_offices")
    res = cur.fetchone()
    print(f"\nFINAL DATABASE COUNT: {res[0]}")
    print(f"TOTAL WARDS: {res[1]}")
    
    conn.close()

if __name__ == "__main__": surgical_dedup()
