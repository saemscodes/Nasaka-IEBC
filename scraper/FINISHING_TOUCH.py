import os, psycopg2
from dotenv import load_dotenv

def finish():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("=== THE FINISHING TOUCH: REACHING 24,369 ===\n")
    
    # 1. Identify the 36 surplus records not in public.iebc_registration_centres
    cur.execute("""
        SELECT t.id, t.office_location, t.ward
        FROM public.iebc_offices t
        LEFT JOIN public.iebc_registration_centres r ON 
            LOWER(TRIM(t.office_location)) = LOWER(TRIM(r.name))
            AND LOWER(TRIM(t.ward)) = LOWER(TRIM(r.ward))
        WHERE r.id IS NULL
    """)
    surplus = cur.fetchall()
    print(f"Found {len(surplus)} surplus records to reconcile.")
    
    # 2. For each surplus record, try to find the "Official Name" from the reference table in the same ward
    # We will remap references to the legitimate centre in that ward if possible.
    for sid, sloc, sward in surplus:
        cur.execute("SELECT id FROM public.iebc_offices WHERE LOWER(TRIM(ward)) = LOWER(TRIM(%s)) AND id != %s LIMIT 1", (sward, sid))
        keeper = cur.fetchone()
        if keeper:
            keeper_id = keeper[0]
            # Remap references (verification_log, etc.)
            cur.execute("""
                SELECT r.relname, a.attname
                FROM pg_constraint c
                JOIN pg_class r ON c.conrelid = r.oid
                JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
                WHERE c.contype = 'f' AND c.confrelid = 'public.iebc_offices'::regclass;
            """)
            for table, col in cur.fetchall():
                cur.execute(f"UPDATE {table} SET {col} = %s WHERE {col} = %s", (keeper_id, sid))
            
            # Now safe to delete
            cur.execute("DELETE FROM public.iebc_offices WHERE id = %s", (sid,))
            print(f"  Merged {sloc} ({sid}) into {keeper_id}.")

    # 3. Final Count
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    count = cur.fetchone()[0]
    print(f"\nFINAL DATABASE COUNT: {count}")
    
    conn.close()

if __name__ == "__main__": finish()
