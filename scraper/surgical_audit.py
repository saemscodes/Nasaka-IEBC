import os, psycopg2
from dotenv import load_dotenv

def surgical_audit():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("\n--- SURGICAL AUDIT: public.iebc_offices ---")
    
    # Get columns using cursor description for real-time accuracy
    cur.execute("SELECT * FROM public.iebc_offices LIMIT 1")
    cols = [desc[0] for desc in cur.description]
    print(f"Exact Columns: {cols}")
    
    row = cur.fetchone()
    if row:
        data = dict(zip(cols, row))
        print("\nSample Data (Simplified):")
        for key in ['id', 'office_location', 'county', 'constituency', 'mapping_uuid']:
            if key in data:
                print(f"  {key}: {data[key]} ({type(data[key])})")
            else:
                print(f"  {key}: MISSING")
                
    conn.close()

if __name__ == "__main__": surgical_audit()
