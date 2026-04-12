import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

password = "1268Saem'sTunes!"
project_id = "ftswzvqwxdwgkvfbwfpx"

def force_cleanup():
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
        
        # 1. Drop the specific unique index that is blocking ingestion
        print("Dropping UNIQUE INDEX idx_iebc_offices_unique...")
        cur.execute("DROP INDEX IF EXISTS public.idx_iebc_offices_unique;")
        
        # 2. Ensure our granular unique constraint is in place
        print("Ensuring granular unique constraint exists...")
        # Note: relation already exists error might happen if we don't check
        cur.execute("""
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'iebc_offices_centre_ward_const_county_key') THEN
                    ALTER TABLE public.iebc_offices 
                    ADD CONSTRAINT iebc_offices_centre_ward_const_county_key 
                    UNIQUE (centre_code, ward_code, constituency_code, county_code);
                END IF;
            END $$;
        """)
        
        conn.commit()
        print("SUCCESS! Database cleanup complete.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    force_cleanup()
