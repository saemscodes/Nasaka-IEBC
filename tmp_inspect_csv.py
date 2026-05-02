import csv

def inspect_csv():
    CSV_PATH = r'C:\Users\Administrator\Downloads\290 CONSTITUENCY IEBC OFFICES - FAIR ATTEMPT.csv'
    try:
        with open(CSV_PATH, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                if i >= 5: break
                print(f"Row {i}: Constituency={row.get('constituency_n')}")
                print(f"  Lat col: {row.get('latitude')}, Lng col: {row.get('longitude')}")
                print(f"  WKT: {row.get('WKT')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_csv()
