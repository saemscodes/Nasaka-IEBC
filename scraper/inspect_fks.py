import os
import psycopg2
from dotenv import load_dotenv

def inspect():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            tc.table_name, 
            kcu.column_name, 
            ccu.table_name AS referenced_table_name,
            ccu.column_name AS referenced_column_name 
        FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'iebc_offices';
    """)
    rows = cur.fetchall()
    print("\n=== FOREIGN KEY DEPENDENCIES FOR iebc_offices ===")
    for r in rows:
        print(f"Table: {r[0]}, Column: {r[1]} -> references {r[2]}.{r[3]}")
    conn.close()

if __name__ == "__main__": inspect()
