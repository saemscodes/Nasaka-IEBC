import os, psycopg2
from dotenv import load_dotenv

def stop_thief():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("=== STOP THE THIEF: ISOLATING DATABASE ===\n")
    
    # 1. Disable all triggers on iebc_offices (even if they seem innocent)
    print("[1/3] Disabling all triggers on iebc_offices...")
    cur.execute("ALTER TABLE public.iebc_offices DISABLE TRIGGER ALL;")
    
    # 2. Kill all other connections (except mine)
    # We identify our own PID first
    cur.execute("SELECT pg_backend_pid();")
    mypid = cur.fetchone()[0]
    print(f"My PID: {mypid}")
    
    print("[2/3] Terminating other backends...")
    cur.execute("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> %s AND datname = current_database();", (mypid,))
    terminated = cur.rowcount
    print(f"      Terminated {terminated} connections.")

    # 3. Final count check
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    print(f"[3/3] Current Count: {cur.fetchone()[0]}")
    
    conn.close()

if __name__ == "__main__": stop_thief()
