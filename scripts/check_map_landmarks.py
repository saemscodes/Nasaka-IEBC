import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def check_map_landmarks():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    print("Checking internal map_landmarks table...")
    try:
        cur.execute("SELECT count(*) FROM public.map_landmarks")
        print(f"Total internal landmarks available: {cur.fetchone()[0]}")
        
        cur.execute("SELECT name, category, latitude, longitude FROM public.map_landmarks LIMIT 10")
        for row in cur.fetchall():
            print(row)
    except Exception as e:
        print(f"Table map_landmarks not found or accessible: {e}")
    
    conn.close()

if __name__ == "__main__":
    check_map_landmarks()
