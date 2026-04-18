import os, csv, psycopg2
from dotenv import load_dotenv

def deep_inspect():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT ward_code, centre_code FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'")
    db_codes = {f"{r[0]}-{r[1]}" for r in cur.fetchall()}
    
    csv_path = "data/processed/cleaned_iebc_offices.csv"
    noise_count = 0
    non_reg_count = 0
    valid_csv_reg = 0
    missing_codes = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        r = csv.reader(f)
        next(r)
        for row in r:
            if len(row) < 11: 
                noise_count += 1
                continue
            
            # Detect PDF artifact noise
            if "Page" in row[0] or "OFFICE LOCATION" in row[3] or not row[0]:
                noise_count += 1
                continue
                
            if row[11] != 'REGISTRATION_CENTRE':
                non_reg_count += 1
                continue
                
            code = f"{row[8]}-{row[10]}"
            if not row[8] or not row[10]:
                missing_codes += 1
                continue
            
            valid_csv_reg += 1
            
    print(f"\n--- DEEP SOURCE INSPECTION (31k CSV) ---")
    print(f"1. PDF Artifacts / Noise Rows: {noise_count}")
    print(f"2. Non-Registration Offices:   {non_reg_count}")
    print(f"3. Rows with Missing Codes:    {missing_codes}")
    print(f"4. Valid Reg Centres in CSV:   {valid_csv_reg}")
    print(f"\n   -> Database Target Count:   {len(db_codes)}")
    
    conn.close()

if __name__ == "__main__": deep_inspect()
