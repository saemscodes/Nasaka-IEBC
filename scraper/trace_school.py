import os, psycopg2
from dotenv import load_dotenv

def trace_baringo():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("Listing Baringo Centres in iebc_offices:")
    cur.execute("SELECT office_location, county, constituency, ward FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' AND county ILIKE '%BARINGO%' LIMIT 5")
    rows = cur.fetchall()
    
    for r in rows:
        print(f"Location: '{r[0]}' | County: '{r[1]}' | Constituency: '{r[2]}' | Ward: '{r[3]}'")
        
    conn.close()

if __name__ == "__main__": trace_baringo()
