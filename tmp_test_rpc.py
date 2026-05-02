import psycopg2

def test_rpc():
    PASSWORD = "1268Saem'sTunes!"
    PROJECT_ID = "ftswzvqwxdwgkvfbwfpx"
    
    try:
        conn = psycopg2.connect(
            host="aws-0-eu-north-1.pooler.supabase.com", port=6543, user=f"postgres.{PROJECT_ID}",
            password=PASSWORD, dbname="postgres", sslmode='require'
        )
        cur = conn.cursor()
        
        # Test RPC with broad bounds at high zoom
        cur.execute("SELECT count(*) FROM public.get_offices_in_bounds(-15.0, -60.0, 15.0, 60.0, 12)")
        count = cur.fetchone()[0]
        print(f"Offices in bounds (Global): {count}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_rpc()
