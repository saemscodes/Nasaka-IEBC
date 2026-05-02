import pandas as pd
import psycopg2
import io

def inspect_csv_and_db():
    print("--- CSV INSPECTION ---")
    csv_path = r'C:\Users\Administrator\Downloads\290 CONSTITUENCY IEBC OFFICES - FAIR ATTEMPT.csv'
    
    try:
        # Try to read the first few lines to get column names and see the mess
        with open(csv_path, 'r', encoding='utf-8') as f:
            lines = [f.readline() for _ in range(15)]
        
        print("First 15 lines of CSV:")
        for i, line in enumerate(lines):
            print(f"{i+1}: {line.strip()}")
            
        # Try reading with python engine to be more flexible
        df = pd.read_csv(csv_path, engine='python', on_bad_lines='warn', nrows=20)
        print("\nColumn names found:")
        print(df.columns.tolist())
        print("\nFirst 5 rows (partial):")
        print(df.head(5))
        
    except Exception as e:
        print(f"Error inspecting CSV: {e}")

    print("\n--- DATABASE SCHEMA INSPECTION ---")
    password = "1268Saem'sTunes!"
    project_id = "ftswzvqwxdwgkvfbwfpx"
    
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
        
        # Get columns of the main table
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'iebc_offices' AND table_schema = 'public' ORDER BY ordinal_position;")
        cols = cur.fetchall()
        print("\niebc_offices table columns:")
        for col in cols:
            print(f"- {col[0]} ({col[1]})")
            
        # Check if backup has data and specific columns like returning officer
        cur.execute("SELECT count(*) FROM public.iebc_offices_backup_20260502;")
        count = cur.fetchone()[0]
        print(f"\nRows in backup: {count}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error inspecting DB: {e}")

if __name__ == "__main__":
    inspect_csv_and_db()
