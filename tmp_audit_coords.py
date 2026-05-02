import psycopg2

def audit_coordinates():
    PASSWORD = "1268Saem'sTunes!"
    PROJECT_ID = "ftswzvqwxdwgkvfbwfpx"
    
    try:
        conn = psycopg2.connect(
            host="aws-0-eu-north-1.pooler.supabase.com", port=6543, user=f"postgres.{PROJECT_ID}",
            password=PASSWORD, dbname="postgres", sslmode='require'
        )
        cur = conn.cursor()
        
        cur.execute('SELECT county, constituency, latitude, longitude FROM public.iebc_offices ORDER BY id')
        rows = cur.fetchall()
        
        with open('d:\\CEKA\\NASAKA\\v005\\iebc_audit.txt', 'w', encoding='utf-8') as f:
            for r in rows:
                f.write(f"{r}\n")
        
        print(f"Audited {len(rows)} records. Results in iebc_audit.txt")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    audit_coordinates()
