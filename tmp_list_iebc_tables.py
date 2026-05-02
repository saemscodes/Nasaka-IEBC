import psycopg2

def list_all_iebc_tables():
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
        
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%iebc%'")
        tables = cur.fetchall()
        print("--- IEBC TABLES ---")
        for t in tables:
            cur.execute(f"SELECT count(*) FROM public.{t[0]}")
            count = cur.fetchone()[0]
            print(f"- {t[0]} ({count} rows)")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    list_all_iebc_tables()
