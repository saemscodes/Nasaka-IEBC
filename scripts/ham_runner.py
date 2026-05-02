import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

def run_surgical_query(query):
    try:
        # Use the URL directly from .env which is already formatted
        db_url = os.getenv("SUPABASE_DB_POOLED_URL")
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute(query)
        
        if cur.description:
            rows = cur.fetchall()
            colnames = [desc[0] for desc in cur.description]
            print(" | ".join(colnames))
            print("-" * 50)
            for row in rows:
                print(" | ".join(str(v) for v in row))
        else:
            print(f"Success: {cur.statusmessage}")
            
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("--- MVITA VERIFICATION ---")
    run_surgical_query("SELECT id, office_location, landmark, landmark_source FROM public.iebc_offices WHERE constituency_name = 'MVITA' AND landmark_source = 'hamilton_v1' LIMIT 5;")
    
    print("\n--- BARINGO PURGE AUDIT ---")
    run_surgical_query("SELECT id, office_location, landmark, county FROM public.iebc_offices WHERE landmark IN ('Westgate Shopping Mall', 'Thika Road') LIMIT 5;")
