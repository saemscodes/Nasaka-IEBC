import psycopg2

def dump_rpc_definition():
    PASSWORD = "1268Saem'sTunes!"
    PROJECT_ID = "ftswzvqwxdwgkvfbwfpx"
    
    try:
        conn = psycopg2.connect(
            host="aws-0-eu-north-1.pooler.supabase.com", port=6543, user=f"postgres.{PROJECT_ID}",
            password=PASSWORD, dbname="postgres", sslmode='require'
        )
        cur = conn.cursor()
        
        cur.execute("""
            SELECT pg_get_functiondef(p.oid) 
            FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'public' AND p.proname = 'get_offices_in_bounds'
        """)
        definition = cur.fetchone()[0]
        
        with open('d:\\CEKA\\NASAKA\\v005\\rpc_def.sql', 'w', encoding='utf-8') as f:
            f.write(definition)
        print("RPC definition dumped to rpc_def.sql")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    dump_rpc_definition()
