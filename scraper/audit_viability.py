import os, psycopg2
from dotenv import load_dotenv

def audit_viability():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    cur.execute("SELECT COUNT(*) FROM public.iebc_registration_centres WHERE centre_code IS NOT NULL AND centre_code != ''")
    coded = cur.fetchone()[0]
    
    cur.execute("SELECT COUNT(*) FROM public.iebc_registration_centres")
    total = cur.fetchone()[0]
    
    print(f"Total Records: {total}")
    print(f"Records with Centre Codes: {coded} ({coded*100/total:.1f}%)")
    
    conn.close()

if __name__ == "__main__": audit_viability()
