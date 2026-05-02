import psycopg2
import os
import json
from dotenv import load_dotenv

def main():
    load_dotenv()
    db_url = os.getenv('SUPABASE_DB_POOLED_URL')
    if not db_url:
        print("Error: SUPABASE_DB_POOLED_URL not found")
        return

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Query check constraints for geocode_audit
        query = """
            SELECT conname, pg_get_constraintdef(c.oid) 
            FROM pg_constraint c 
            JOIN pg_class cr ON cr.oid = c.conrelid 
            WHERE cr.relname = 'geocode_audit'
        """
        cur.execute(query)
        constraints = cur.fetchall()
        
        print(json.dumps(constraints, indent=2))
        
        # Also check issue_type enum or similar if it's a column type
        cur.execute("""
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'geocode_audit'
        """)
        columns = cur.fetchall()
        print("\nColumns:")
        print(json.dumps(columns, indent=2))
        
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
