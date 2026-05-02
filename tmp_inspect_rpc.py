import psycopg2

def inspect_rpc_and_types():
    PASSWORD = "1268Saem'sTunes!"
    PROJECT_ID = "ftswzvqwxdwgkvfbwfpx"
    
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
        
        # 1. Get RPC definition
        cur.execute("SELECT prosrc FROM pg_proc WHERE proname = 'get_offices_in_bounds'")
        res = cur.fetchone()
        if res:
            print("--- RPC DEFINITION ---")
            print(res[0])
        else:
            print("RPC get_offices_in_bounds not found in pg_proc")
            
        # 2. Get distinct office types from backup
        cur.execute("SELECT DISTINCT office_type FROM public.iebc_offices_backup_20260425")
        types = cur.fetchall()
        print("\n--- DISTINCT OFFICE TYPES IN BACKUP ---")
        for t in types:
            print(f"- '{t[0]}'")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_rpc_and_types()
