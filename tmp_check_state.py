import pandas as pd
import psycopg2
from datetime import datetime

def check_everything():
    password = "1268Saem'sTunes!"
    project_id = "ftswzvqwxdwgkvfbwfpx"
    backup_suffix = "20260502" # Hardcoded to match previous run
    
    try:
        conn = psycopg2.connect(
            host="aws-0-eu-north-1.pooler.supabase.com",
            port=6543,
            user=f"postgres.{project_id}",
            password=password,
            dbname="postgres",
            sslmode='require'
        )
        cur = conn.cursor()
        
        print("Checking for backup tables...")
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'iebc_offices_backup%';")
        tables = cur.fetchall()
        for t in tables:
            cur.execute(f"SELECT count(*) FROM public.{t[0]};")
            count = cur.fetchone()[0]
            print(f"- {t[0]}: {count} rows")
            
        # Also check iebc_office_contributions_backup
        cur.execute(f"SELECT count(*) FROM public.iebc_office_contributions_backup_{backup_suffix};")
        count = cur.fetchone()[0]
        print(f"- iebc_office_contributions_backup_{backup_suffix}: {count} rows")

        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error checking DB: {e}")

    print("\nCSV Snapshot (raw lines):")
    csv_path = r'C:\Users\Administrator\Downloads\290 CONSTITUENCY IEBC OFFICES - FAIR ATTEMPT.csv'
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            for i in range(15):
                print(f"{i+1}: {f.readline().strip()}")
    except Exception as e:
        print(f"Error reading CSV: {e}")

if __name__ == "__main__":
    check_everything()
