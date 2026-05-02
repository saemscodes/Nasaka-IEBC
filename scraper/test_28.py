"""Test if the 28 RC records with coords match anything in OF."""
import os, psycopg2
from dotenv import load_dotenv

def test():
    load_dotenv()
    conn = psycopg2.connect(os.environ['SUPABASE_DB_POOLED_URL'])
    cur = conn.cursor()

    cur.execute("SELECT name, county FROM public.iebc_registration_centres WHERE latitude IS NOT NULL")
    rc_rows = cur.fetchall()
    print(f"RC records with coords: {len(rc_rows)}")

    for name, county in rc_rows:
        norm_name = ' '.join(name.split()).upper()
        norm_county = ' '.join(county.split()).upper()

        # Direct exact match
        cur.execute("SELECT id, office_location FROM public.iebc_offices WHERE UPPER(TRIM(office_location)) = %s AND UPPER(TRIM(county)) = %s AND office_type = 'REGISTRATION_CENTRE'", (norm_name, norm_county))
        direct = cur.fetchone()
        
        # Loose ILIKE
        cur.execute("SELECT id, office_location FROM public.iebc_offices WHERE office_location ILIKE %s AND county ILIKE %s AND office_type = 'REGISTRATION_CENTRE'", (f"%{norm_name}%", f"%{norm_county}%"))
        loose = cur.fetchone()

        status = "DIRECT" if direct else ("LOOSE" if loose else "NONE")
        of_loc = (direct or loose or [None, None])[1]
        print(f"  [{status}] RC='{name}' OF='{of_loc}'")

    conn.close()

if __name__ == "__main__":
    test()
