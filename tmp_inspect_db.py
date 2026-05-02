import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

password = "1268Saem'sTunes!"
project_id = "ftswzvqwxdwgkvfbwfpx"

def inspect_dependencies():
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
        
        # Check for foreign key constraints referencing iebc_offices
        print("Checking for foreign key dependencies...")
        cur.execute("""
            SELECT
                tc.table_schema, 
                tc.table_name, 
                kcu.column_name, 
                ccu.table_schema AS foreign_table_schema,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name 
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name='iebc_offices';
        """)
        
        deps = cur.fetchall()
        if deps:
            print("Tables referencing iebc_offices:")
            for dep in deps:
                table_name = f"{dep[0]}.{dep[1]}"
                print(f"- {table_name} ({dep[2]}) -> {dep[3]}.{dep[4]} ({dep[5]})")
                cur.execute(f"SELECT count(*) FROM {table_name};")
                dep_count = cur.fetchone()[0]
                print(f"  Current row count in {table_name}: {dep_count}")
        else:
            print("No external tables found referencing iebc_offices.")
            
        # Count current rows
        cur.execute("SELECT count(*) FROM public.iebc_offices;")
        count = cur.fetchone()[0]
        print(f"Current row count in iebc_offices: {count}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_dependencies()
