import os, psycopg2
from dotenv import load_dotenv

def verify_ui():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("\n=== RECONCILING 24,959 TOTAL RECORDS ===")
    
    # 1. Registration Centres
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'")
    reg_centres = cur.fetchone()[0]
    
    # 2. IEBC Offices (Constituency, Regional, Tallying)
    cur.execute("SELECT office_type, COUNT(*) FROM public.iebc_offices WHERE office_type != 'REGISTRATION_CENTRE' GROUP BY office_type")
    other_offices = cur.fetchall()
    
    # 3. Final Total
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    total = cur.fetchone()[0]
    
    print(f"Registration Centres: {reg_centres}")
    print(f"Other IEBC Offices:")
    other_total = 0
    for r in other_offices:
        print(f"  - {r[0]}: {r[1]}")
        other_total += r[1]
    
    print(f"Total Database Count: {total}")
    
    if total == 24959:
        print("\n✅ MATCH: The UI shows the full table count (Registrations + Administrative Offices).")
    else:
        print(f"\n❌ Still a delta: {total} vs 24,959")
        
    conn.close()

if __name__ == "__main__": verify_ui()
