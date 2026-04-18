import os, psycopg2
from dotenv import load_dotenv

def find_clashes():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("\n--- CLASH DETECTION: Registrations vs Offices ---")
    
    # Do any Registration Centres share codes with Constituency Offices?
    cur.execute("""
        SELECT a.ward_code, a.centre_code, a.office_location, b.office_location
        FROM public.iebc_offices a
        JOIN public.iebc_offices b ON a.ward_code = b.ward_code AND a.centre_code = b.centre_code
        WHERE a.office_type = 'REGISTRATION_CENTRE'
          AND b.office_type = 'CONSTITUENCY_OFFICE'
          AND a.id != b.id
    """)
    clashes = cur.fetchall()
    print(f"Code Clashes found: {len(clashes)}")
    for c in clashes[:3]:
        print(f"  Code: {c[0]}-{c[1]} | Reg: {c[2]} | Office: {c[3]}")
    
    conn.close()

if __name__ == "__main__": find_clashes()
