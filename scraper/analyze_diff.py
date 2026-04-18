import os, csv, psycopg2
from dotenv import load_dotenv

def analyze_diff():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    
    # 1. Get DB Codes
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT ward_code, centre_code FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'")
    db_codes = {f"{r[0]}-{r[1]}" for r in cur.fetchall()}
    
    # 2. Analyze CSV
    csv_path = "data/processed/cleaned_iebc_offices.csv"
    discarded = []
    total_csv_rows = 0
    with open(csv_path, 'r', encoding='utf-8') as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            total_csv_rows += 1
            if len(row) < 11: continue
            code = f"{row[8]}-{row[10]}"
            if code not in db_codes:
                discarded.append(row)
    
    print(f"\n--- DATA ANALYSIS (31k vs 24k) ---")
    print(f"Total Rows in CSV:       {total_csv_rows}")
    print(f"Total Centres in DB:    {len(db_codes)}")
    print(f"Total Discarded:        {len(discarded)}")
    
    # 3. Categorize Discarded
    no_code = [row for row in discarded if not row[8] or not row[10]]
    office_type = [row for row in discarded if row[11] != 'REGISTRATION_CENTRE']
    duplicates = len(discarded) - len(no_code) - len(office_type)
    
    print(f"\nBreakdown of what was left out:")
    print(f"1. Incomplete/No Codes:   {len(no_code)}")
    print(f"2. Non-Reg Centres:       {len(office_type)}")
    print(f"3. Redundant Overlaps:    {duplicates}")
    
    if discarded:
        print("\nSample of discarded records (Reason: likely duplicate or out-of-scope):")
        for row in discarded[:5]:
            print(f"  - {row[3]} ({row[9]}, {row[2]}) | Code: {row[8]}-{row[10]}")
            
    conn.close()

if __name__ == "__main__": analyze_diff()
