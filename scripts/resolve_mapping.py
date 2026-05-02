import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

def resolve_mapping():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("Searching for potential matches for Mvita...")
    # List all PROD offices in Mvita
    cur.execute("SELECT id, office_location FROM public.iebc_offices WHERE constituency_name = 'MVITA'")
    prod = cur.fetchall()
    
    # List all LEGACY offices in Mvita
    cur.execute("SELECT id, office_location, landmark FROM public.iebc_offices_legacy_backup WHERE constituency = 'MVITA' OR constituency_name = 'MVITA'")
    legacy = cur.fetchall()
    
    for p_id, p_loc in prod:
        print(f"\nPROD: [{p_loc}]")
        for l_id, l_loc, l_mark in legacy:
            cur.execute("SELECT similarity(%s, %s), similarity(%s, %s)", (p_loc or "", l_loc or "", p_loc or "", l_mark or ""))
            s1, s2 = cur.fetchone()
            s1 = s1 or 0
            s2 = s2 or 0
            if s1 > 0.4 or s2 > 0.4:
                print(f"  LEGACY: [{l_loc}] | Mark: [{l_mark}] | SimLoc: {s1:.2f} | SimMark: {s2:.2f}")

    conn.close()

if __name__ == "__main__":
    resolve_mapping()
