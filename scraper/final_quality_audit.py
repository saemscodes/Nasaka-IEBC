import os, psycopg2
from dotenv import load_dotenv

def final_quality_audit():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("\n=== FINAL MISSION-CRITICAL QUALITY AUDIT ===")
    
    # 1. Duplicate Code Check
    cur.execute("""
        SELECT ward_code, centre_code, COUNT(*) 
        FROM public.iebc_offices 
        GROUP BY ward_code, centre_code 
        HAVING COUNT(*) > 1
    """)
    dups = cur.fetchall()
    
    # 2. Placement/Mock Check
    mock_keywords = ['test', 'mock', 'placeholder', 'dummy', 'junk']
    mock_found = []
    for kw in mock_keywords:
        cur.execute(f"SELECT COUNT(*) FROM public.iebc_offices WHERE office_location ILIKE '%{kw}%'")
        mock_found.append((kw, cur.fetchone()[0]))
    
    # 3. Administrative Completeness
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE ward_code IS NULL OR centre_code IS NULL")
    missing_codes = cur.fetchone()[0]
    
    # 4. Ward Count
    cur.execute("SELECT COUNT(DISTINCT ward_code) FROM public.iebc_offices")
    wards = cur.fetchone()[0]

    print(f"\n1. Duplicate Codes Found:    {len(dups)}")
    print(f"2. Administrative Coverage:   {100 - (missing_codes * 100 / 24559):.2f}%")
    print(f"3. Unique Wards:              {wards} (Target: 1,450)")
    print(f"4. Mock Data Detection:")
    for kw, count in mock_found:
        print(f"  - '{kw}': {count} records")
        
    print(f"\nFINAL STATUS: {'PASS' if len(dups) == 0 and missing_codes == 0 else 'FAIL'}")
    conn.close()

if __name__ == "__main__": final_quality_audit()
