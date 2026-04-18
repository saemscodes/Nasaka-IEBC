import os, psycopg2
from dotenv import load_dotenv

def db_police():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("=== DATABASE POLICE: INVESTIGATING DELETIONS ===\n")
    
    # 1. Check Active Queries
    print("[1/3] Active DELETE/UPDATE queries:")
    cur.execute("SELECT pid, query, state, query_start FROM pg_stat_activity WHERE query ILIKE '%delete%' OR query ILIKE '%update%';")
    for r in cur.fetchall():
        print(f"  PID: {r[0]} | Query: {r[1][:100]} | Start: {r[3]}")

    # 2. Check Triggers on iebc_offices
    print("\n[2/3] Triggers on public.iebc_offices:")
    cur.execute("SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.iebc_offices'::regclass;")
    for r in cur.fetchall():
        print(f"  Trigger: {r[0]}")

    # 3. Check for pg_cron
    print("\n[3/3] Scheduled Jobs (pg_cron):")
    try:
        cur.execute("SELECT jobid, jobname, schedule, command FROM cron.job;")
        for r in cur.fetchall():
            print(f"  Job: {r[1]} | Schedule: {r[2]} | Cmd: {r[3]}")
    except:
        print("  pg_cron not available or no access.")

    conn.close()

if __name__ == "__main__": db_police()
