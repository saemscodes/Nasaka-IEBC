import psycopg2
import os
from datetime import datetime

password = "1268Saem'sTunes!"
project_id = "ftswzvqwxdwgkvfbwfpx"
backup_suffix = datetime.now().strftime("%Y%m%d")

def execute_fresh_slate():
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
        
        print(f"--- STARTING FRESH SLATE OPERATION ({backup_suffix}) ---")
        
        # 0. DYNAMICALLY DISCOVER DEPENDENCIES
        print("Discovering all dependencies for public.iebc_offices...")
        cur.execute("""
            SELECT
                tc.table_schema, 
                tc.table_name
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name='iebc_offices'
            GROUP BY tc.table_schema, tc.table_name;
        """)
        
        deps = cur.fetchall()
        tables_to_backup = ['public.iebc_offices']
        for dep in deps:
            tables_to_backup.append(f"{dep[0]}.{dep[1]}")
            
        print(f"Tables to be backed up and cleared: {', '.join(tables_to_backup)}")

        # 1. CREATE BACKUPS
        for table in tables_to_backup:
            backup_table = f"{table}_backup_{backup_suffix}"
            print(f"Backing up {table} to {backup_table}...")
            cur.execute(f"DROP TABLE IF EXISTS {backup_table};")
            cur.execute(f"CREATE TABLE {backup_table} AS SELECT * FROM {table};")
            cur.execute(f"SELECT count(*) FROM {backup_table};")
            count = cur.fetchone()[0]
            print(f"  Backup created: {count} rows saved.")

        # 2. CLEAR TABLES WITH FINALITY
        print("\nExecuting TRUNCATE CASCADE on public.iebc_offices...")
        cur.execute("TRUNCATE TABLE public.iebc_offices RESTART IDENTITY CASCADE;")
        
        # 3. VERIFY
        print("\nVerifying results:")
        for table in tables_to_backup:
            cur.execute(f"SELECT count(*) FROM {table};")
            count = cur.fetchone()[0]
            status = "CLEARED" if count == 0 else f"FAILED (still has {count} rows)"
            print(f"- {table}: {status}")
            
        # Check sequence
        cur.execute("SELECT last_value, is_called FROM public.iebc_offices_id_seq;")
        seq_info = cur.fetchone()
        print(f"- Sequence status for iebc_offices_id_seq: {seq_info}")

        conn.commit()
        print("\n--- OPERATION COMPLETE. FRESH SLATE ACHIEVED. ---")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"\nFATAL ERROR: {e}")
        if 'conn' in locals():
            conn.rollback()

if __name__ == "__main__":
    execute_fresh_slate()
