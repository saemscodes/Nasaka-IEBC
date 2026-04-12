import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

password = "1268Saem'sTunes!"
project_id = "ftswzvqwxdwgkvfbwfpx"

def verify_count():
    try:
        conn = psycopg2.connect(
            host="aws-0-eu-north-1.pooler.supabase.com",
            port=6543,
            user=f"postgres.{project_id}",
            password=password,
            dbname="postgres",
            sslmode='require'
        )
        cur = conn.cursor()
        cur.execute("SELECT count(*) FROM public.iebc_offices")
        count = cur.fetchone()[0]
        print(f"Total Records in public.iebc_offices: {count}")
        
        cur.execute("SELECT count(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'")
        reg_count = cur.fetchone()[0]
        print(f"Registration Centres: {reg_count}")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    verify_count()
