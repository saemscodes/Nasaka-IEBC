import os, csv, psycopg2
from dotenv import load_dotenv

def check():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    
    # 1. Unique codes from CSV
    csv_codes = set()
    csv_path = "data/processed/cleaned_iebc_offices.csv"
    with open(csv_path, 'r', encoding='utf-8') as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            if len(row) >= 11 and row[8] and row[10]:
                csv_codes.add(f"{row[8]}-{row[10]}")
    
    print(f"CSV Unique Centres: {len(csv_codes):,}")
    
    # 2. Unique codes from DB
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT ward_code, centre_code FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' AND ward_code IS NOT NULL AND centre_code IS NOT NULL")
    db_codes = {f"{r[0]}-{r[1]}" for r in cur.fetchall()}
    print(f"DB Unique Centres:  {len(db_codes):,}")
    
    missing = csv_codes - db_codes
    print(f"Missing from DB:    {len(missing):,}")
    
    if missing:
        print("\n[HAM MODE] Missing centres must be inserted for 100% turnover.")
    
    conn.close()

if __name__ == "__main__": check()
