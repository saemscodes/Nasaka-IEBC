import psycopg2
import os
from dotenv import load_dotenv

def main():
    load_dotenv()
    db_url = os.getenv('SUPABASE_DB_POOLED_URL')
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute("SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class cr ON cr.oid = c.conrelid WHERE cr.relname = 'geocode_audit'")
    constraints = cur.fetchall()
    for name, defn in constraints:
        print(f"START_CONSTRAINT {name}")
        print(defn)
        print(f"END_CONSTRAINT {name}")
    
    conn.close()

if __name__ == "__main__":
    main()
