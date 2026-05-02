import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def check_tables():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    # Check legacy backup columns
    print("\n--- iebc_offices_legacy_backup ---")
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'iebc_offices_legacy_backup'")
    cols = cur.fetchall()
    if not cols:
        print("Table iebc_offices_legacy_backup not found or no columns.")
    else:
        for col in cols:
            print(f"{col[0]}: {col[1]}")
        
    # Check current iebc_offices columns
    print("\n--- iebc_offices ---")
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'iebc_offices'")
    for col in cur.fetchall():
        print(f"{col[0]}: {col[1]}")
    
    # Check office_type values in production
    print("\n--- office_type values in production ---")
    cur.execute("SELECT DISTINCT office_type FROM public.iebc_offices")
    for val in cur.fetchall():
        print(f"- {val[0]}")
        
    # Check if we have data mismatch
    print("\n--- Sample data from production (office_location, office_type, ward) ---")
    cur.execute("SELECT office_location, office_type, ward FROM public.iebc_offices LIMIT 5")
    for row in cur.fetchall():
        print(f"Location: {row[0]} | Type: {row[1]} | Ward: {row[2]}")
        
    conn.close()

if __name__ == "__main__":
    check_tables()
