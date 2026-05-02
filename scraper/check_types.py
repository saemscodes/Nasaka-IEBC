import os, psycopg2
from dotenv import load_dotenv

def check_types():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'iebc_offices' AND column_name IN ('id', 'mapping_uuid')")
    for r in cur.fetchall():
        print(f"Column: {r[0]} | Type: {r[1]}")
        
    cur.execute("SELECT id, mapping_uuid FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' LIMIT 1")
    row = cur.fetchone()
    if row:
        print(f"Sample - ID: {row[0]} ({type(row[0])}) | MappingUUID: {row[1]} ({type(row[1])})")
        
    conn.close()

if __name__ == "__main__": check_types()
