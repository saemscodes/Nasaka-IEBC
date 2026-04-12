import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# User provided credentials from apply_migration_auto.py
password = "1268Saem'sTunes!"
project_id = "ftswzvqwxdwgkvfbwfpx"

# Supabase pooler often requires user.project_id format
configs = [
    {"host": "aws-0-eu-north-1.pooler.supabase.com", "port": 6543, "user": f"postgres.{project_id}", "dbname": "postgres"},
    {"host": "aws-0-eu-north-1.pooler.supabase.com", "port": 5432, "user": f"postgres.{project_id}", "dbname": "postgres"},
    {"host": f"db.{project_id}.supabase.co", "port": 5432, "user": "postgres", "dbname": "postgres"}
]

for config in configs:
    print(f"Trying {config['host']}:{config['port']} as {config['user']}...")
    try:
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            user=config['user'],
            password=password,
            dbname=config['dbname'],
            sslmode='require',
            connect_timeout=10
        )
        print("SUCCESS! Connected.")
        
        migration_path = "supabase/migrations/20260401_search_rpc.sql"
        with open(migration_path, "r") as f:
            sql = f.read()
            
        cur = conn.cursor()
        cur.execute(sql)
        conn.commit()
        print("SEARCH RPC MIGRATION APPLIED SUCCESSFULLY.")
        cur.close()
        conn.close()
        exit(0)
    except Exception as e:
        print(f"FAILED on {config['host']}:{config['port']}: {e}")

print("All connection attempts failed.")
exit(1)
