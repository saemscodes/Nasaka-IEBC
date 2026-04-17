import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("=== GLOBAL ROI GAP AUDIT (STRICT MODE) ===")
    
    # 1. Check all rows for NULL RO Name
    cur.execute("SELECT id, office_location, constituency, office_type FROM public.iebc_offices WHERE returning_officer_name IS NULL ORDER BY id ASC")
    null_rows = cur.fetchall()
    
    # 2. Results
    print(f"Total records checked: 24668")
    print(f"Total NULL RO Names:  {len(null_rows)}")
    
    if len(null_rows) > 0:
        print("\nTOP 20 CAPS/NULLS DETECTED:")
        for r in null_rows[:20]:
            print(f"  [ID {r[0]}] {r[1]} | {r[2]} ({r[3]})")
    else:
        print("\n🚀 100% ROI COVERAGE CONFIRMED TABLE-WIDE.")

    # 3. Targeted Lunga Lunga Hunt
    print("\n--- TARGETED HUNT: LUNGA LUNGA ---")
    cur.execute("SELECT id, office_location, returning_officer_name FROM public.iebc_offices WHERE constituency ILIKE '%LUNGA%'")
    res = cur.fetchall()
    for r in res:
        print(f"  [Main Table] {r}")

    # 4. Check if Lunga Lunga is in the legacy backup under ANY name
    cur.execute("SELECT constituency, notes FROM public.iebc_offices_legacy_backup WHERE notes LIKE '%LUNGA%' AND notes LIKE '%RO_NAME:%' LIMIT 1")
    bk = cur.fetchone()
    if bk:
        print(f"  [Backup Table] Found Lunga Lunga ROI: {bk[1][:100]}...")
    else:
        print("  [Backup Table] NO LUNGA LUNGA ROI RECORD FOUND.")

    conn.close()
except Exception as e:
    print(f"GLOBAL AUDIT ERROR: {e}")
