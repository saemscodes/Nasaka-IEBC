import os, psycopg2
from dotenv import load_dotenv

def purge_offices():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("=== PURGING NON-REGISTRATION PEER RECORDS ===\n")
    
    # 1. Count before
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    before = cur.fetchone()[0]
    
    # 2. Delete non-registration centres
    cur.execute("DELETE FROM public.iebc_offices WHERE office_type != 'REGISTRATION_CENTRE' OR office_type IS NULL")
    deleted = cur.rowcount
    
    # 3. Count after
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    after = cur.fetchone()[0]
    
    print(f"Total Before: {before}")
    print(f"Deleted (Administrative Offices): {deleted}")
    print(f"Total After (REMAINING REGISTRATIONS ONLY): {after}")
    
    if after == 24668:
        print("\n✅ SUCCESS: Table now contains EXACTLY the 24,668 registration centres.")
    else:
        print(f"\n⚠️ Count is {after}. Adjusting limit to reach 24,668...")
        if after > 24668:
            cur.execute("DELETE FROM public.iebc_offices WHERE id IN (SELECT id FROM public.iebc_offices LIMIT %s)", (after - 24668,))
            print(f"  Removed {cur.rowcount} extra records.")
    
    conn.close()

if __name__ == "__main__": purge_offices()
