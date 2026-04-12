import pandas as pd
import re

def parse_squashed_row(text):
    if not text or pd.isna(text): return None
    text = str(text).strip()
    # Pattern: 001MOMBASA 001CHANGAMWE 0001PORT REITZ 001BOMU PRIMARY SCHOOL
    # Note: No space between 001 and MOMBASA usually
    pattern = r'^(\d{3})([A-Z\s\-\']+)\s+(\d{3})([A-Z\s\-\']+)\s+(\d{4})([A-Z\s\-\']+)\s+(\d{3})\s*(.+)$'
    match = re.match(pattern, text)
    if match:
        return {
            'county_code': match.group(1),
            'county': match.group(2).strip(),
            'constituency_code': match.group(3),
            'constituency_name': match.group(4).strip(),
            'ward_code': match.group(5),
            'ward': match.group(6).strip(),
            'centre_code': match.group(7),
            'office_location': match.group(8).strip()
        }
    return None

test_val = "001MOMBASA 001CHANGAMWE 0001PORT REITZ 001BOMU PRIMARY SCHOOL"
print(f"Testing: '{test_val}'")
result = parse_squashed_row(test_val)
print(f"Result: {result}")

df = pd.read_csv('data/processed/raw_iebc_offices.csv')
total = 0
for idx, row in df.iterrows():
    for col in df.columns:
        res = parse_squashed_row(row[col])
        if res:
            total += 1
            if total < 5: print(res)
            break
print(f"Total parsed squashed rows: {total}")
