import os, psycopg2, time
from dotenv import load_dotenv

def monitor_count():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("--- REAL-TIME COUNT MONITORING (60s) ---")
    for i in range(10):
        cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
        count = cur.fetchone()[0]
        cur.execute("SELECT office_type, COUNT(*) FROM public.iebc_offices GROUP BY office_type")
        types = cur.fetchall()
        print(f"[{time.strftime('%H:%M:%S')}] Total: {count} | Types: {types}")
        time.sleep(2)
    
    conn.close()

if __name__ == "__main__": monitor_count()
