import pdfplumber
from pathlib import Path
import os

pdf_path = Path("data/raw/Physical_Locations_of_County_and_Constituency_Offices_in_Kenya.pdf")

if not pdf_path.exists():
    print(f"Error: {pdf_path} not found.")
    # List files in data/raw
    print("Files in data/raw:")
    for f in Path("data/raw").iterdir():
        print(f" - {f.name}")
    exit(1)

print(f"Opening {pdf_path}...")
with pdfplumber.open(pdf_path) as pdf:
    print(f"Total pages: {len(pdf.pages)}")
    # Check page 1 and page 10 (random)
    for pg_num in [0, 9]:
        if pg_num < len(pdf.pages):
            page = pdf.pages[pg_num]
            print(f"\n--- Page {pg_num + 1} ---")
            table = page.extract_table()
            if table:
                for row in table[:10]:
                    print(row)
            else:
                text = page.extract_text()
                if text:
                    print(text[:1000])
                else:
                    print("No text or table found on this page.")
