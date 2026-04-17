import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    print("[FIX-LUNGA] Hunting for Lunga Lunga metadata...")
    
    # 1. Search in centres (fuzzy name)
    cur.execute("""
        SELECT returning_officer_name, returning_officer_email 
        FROM public.iebc_offices 
        WHERE (constituency ILIKE '%LUNGA%') 
          AND office_type = 'REGISTRATION_CENTRE' 
          AND returning_officer_name IS NOT NULL 
        LIMIT 1
    """)
    row = cur.fetchone()
    
    if row:
        print(f"  ✓ FOUND in centres: {row}")
        cur.execute("UPDATE public.iebc_offices SET returning_officer_name = %s, returning_officer_email = %s WHERE id = 8", (row[0], row[1]))
        print("  ✓ Updated ID 8.")
    else:
        # 2. Search in backup
        print("  ! Not found in centres. Checking backup...")
        cur.execute("""
            SELECT notes 
            FROM public.iebc_offices_legacy_backup 
            WHERE (constituency ILIKE '%LUNGA%') 
              AND notes LIKE '%RO_NAME:%' 
            LIMIT 1
        """)
        backup_row = cur.fetchone()
        if backup_row:
            import re
            notes = backup_row[0]
            name = re.search(r"RO_NAME:\s*([^|]+)", notes)
            email = re.search(r"RO_EMAIL:\s*([^\s|]+)", notes)
            if name:
                print(f"  ✓ FOUND in backup: {name.group(1)}")
                cur.execute("UPDATE public.iebc_offices SET returning_officer_name = %s, returning_officer_email = %s WHERE id = 8", (name.group(1).strip(), email.group(1).strip() if email else None))
                print("  ✓ Updated ID 8 from backup.")
            else:
                print("  ! Backup record found but no RO patterns.")
        else:
            print("  ! Not found in backup either.")

    # Final Check ID 8
    cur.execute("SELECT id, office_location, returning_officer_name FROM public.iebc_offices WHERE id = 8")
    print(f"ID 8 FINAL CHECK: {cur.fetchone()}")
    
    conn.close()
except Exception as e:
    print(f"LUNGA LUNGA FIX ERROR: {e}")
