import os, psycopg2, time
from dotenv import load_dotenv

def monitor_and_freeze():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("--- MONITORING COUNT FOR REDUCTION (30s) ---")
    prev_count = None
    for i in range(30):
        cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
        count = cur.fetchone()[0]
        if prev_count is not None and count < prev_count:
            print(f"!!! REDUCTION DETECTED: {prev_count} -> {count}")
        elif prev_count is not None and count > prev_count:
            print(f"    INCREASE DETECTED: {prev_count} -> {count}")
        else:
            print(f"    Stable: {count}")
        prev_count = count
        time.sleep(1)
    
    conn.close()

if __name__ == "__main__": monitor_and_freeze()
