import os, psycopg2
from dotenv import load_dotenv

def inspect_target():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("\n--- AUDITING REFERENCE TABLE: public.iebc_registration_centres ---")
    
    cur.execute("SELECT COUNT(*), COUNT(DISTINCT ward_code) FROM public.iebc_registration_centres")
    count, wards = cur.fetchone()
    print(f"Total Centres: {count}")
    print(f"Total Wards:   {wards}")
    
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'iebc_registration_centres'")
    cols = [r[0] for r in cur.fetchall()]
    print(f"Columns: {cols}")
    
    # Sample data
    cur.execute("SELECT ward_code, centre_code, registration_centre FROM public.iebc_registration_centres LIMIT 5")
    print("\nSample Data:")
    for r in cur.fetchall():
        print(f"  {r[0]}-{r[1]} | {r[2]}")
        
    conn.close()

if __name__ == "__main__": inspect_target()
