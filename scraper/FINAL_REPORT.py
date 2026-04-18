import os, psycopg2
from dotenv import load_dotenv

def final_report():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    count = cur.fetchone()[0]
    print(f"Final Count: {count}")
    
    cur.execute("SELECT COUNT(DISTINCT ward_code) FROM public.iebc_offices")
    wards = cur.fetchone()[0]
    print(f"Total Wards: {wards}")
    
    conn.close()

if __name__ == "__main__": final_report()
