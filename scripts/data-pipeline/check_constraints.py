import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

password = "1268Saem'sTunes!"
project_id = "ftswzvqwxdwgkvfbwfpx"

def find_stubborn_index():
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
        
        print("Searching for 'idx_iebc_offices_unique' in system catalog...")
        cur.execute("""
            SELECT n.nspname, c.relname, c.relkind
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = 'idx_iebc_offices_unique';
        """)
        results = cur.fetchall()
        for schema, name, kind in results:
            print(f"- FOUND: [{schema}] {name} (kind: {kind})")
            
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    find_stubborn_index()
