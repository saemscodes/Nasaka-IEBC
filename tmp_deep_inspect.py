import psycopg2

def deep_inspect():
    PASSWORD = "1268Saem'sTunes!"
    PROJECT_ID = "ftswzvqwxdwgkvfbwfpx"
    BACKUP_TABLE = "public.iebc_offices_backup_20260425"
    TARGET_TABLE = "public.iebc_offices"

    try:
        conn = psycopg2.connect(
            host="aws-0-eu-north-1.pooler.supabase.com",
            port=6543,
            user=f"postgres.{PROJECT_ID}",
            password=PASSWORD,
            dbname="postgres",
            sslmode='require'
        )
        cur = conn.cursor()
        
        # 1. Get all constituency offices from backup
        print("Fetching unique constituencies from backup...")
        cur.execute(f"""
            SELECT DISTINCT county, constituency_name 
            FROM {BACKUP_TABLE} 
            WHERE office_type = 'CONSTITUENCY_OFFICE' 
            ORDER BY county, constituency_name
        """)
        backup_consts = cur.fetchall()
        print(f"Total constituency offices in backup: {len(backup_consts)}")
        
        # 2. Get current ones in target
        cur.execute(f"SELECT DISTINCT county, constituency_name FROM {TARGET_TABLE}")
        current_consts = set(cur.fetchall())
        print(f"Total constituencies in target: {len(current_consts)}")
        
        # 3. Check for NULLs in target
        cur.execute(f"""
            SELECT 
                count(*) filter (where returning_officer_name is null) as missing_ro_name,
                count(*) filter (where returning_officer_email is null) as missing_ro_email,
                count(*) filter (where county_code is null) as missing_county_code,
                count(*) filter (where constituency_code is null) as missing_const_code
            FROM {TARGET_TABLE}
        """)
        null_counts = cur.fetchone()
        print(f"\nNULL counts in target: {null_counts}")
        
        # 4. Check RPC existence
        print("\nChecking for get_offices_in_bounds RPC...")
        cur.execute("SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_offices_in_bounds';")
        rpc = cur.fetchone()
        if rpc:
            print(f"RPC {rpc[0]} EXISTS.")
            # Check a sample call to RPC
            cur.execute("SELECT count(*) FROM public.get_offices_in_bounds(-10, 30, 10, 50, 5);")
            rpc_count = cur.fetchone()[0]
            print(f"RPC returned {rpc_count} offices for a global bound.")
        else:
            print("RPC get_offices_in_bounds MISSING!")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    deep_inspect()
