import os, psycopg2
from dotenv import load_dotenv

def merge_offices():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("=== MERGING CONSTITUENCY OFFICES INTO REGISTRATION CENTRES (v2) ===\n")
    
    # Identify referencing tables
    cur.execute("""
        SELECT r.relname, a.attname
        FROM pg_constraint c
        JOIN pg_class r ON c.conrelid = r.oid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.contype = 'f' AND c.confrelid = 'public.iebc_offices'::regclass;
    """)
    ref_tables = cur.fetchall()
    
    # Perform batched remapping for each referencing table
    for table, col in ref_tables:
        print(f"  Remapping {table}.{col}...")
        cur.execute(f"""
            UPDATE {table} v
            SET {col} = m.keeper_id
            FROM (
                SELECT a.id as keeper_id, b.id as victim_id
                FROM public.iebc_offices a
                JOIN public.iebc_offices b ON a.ward_code = b.ward_code AND a.centre_code = b.centre_code
                WHERE a.office_type = 'REGISTRATION_CENTRE' AND b.office_type != 'REGISTRATION_CENTRE'
            ) AS m
            WHERE v.{col} = m.victim_id;
        """)
        print(f"    - {cur.rowcount} references updated.")

    # Delete the redundant non-registration records
    cur.execute("""
        DELETE FROM public.iebc_offices 
        WHERE office_type != 'REGISTRATION_CENTRE' OR office_type IS NULL
    """)
    print(f"\nPruned {cur.rowcount} duplicated/standalone administrative offices.")

    # Final Verification
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    count = cur.fetchone()[0]
    print(f"FINAL DATABASE COUNT: {count}")
    
    conn.close()

if __name__ == "__main__": merge_offices()
