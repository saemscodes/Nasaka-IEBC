import csv

def get_csv_headers():
    csv_path = r'C:\Users\Administrator\Downloads\290 CONSTITUENCY IEBC OFFICES - FAIR ATTEMPT.csv'
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            headers = next(reader)
            print("CSV Headers:")
            print(headers)
            
            # Print row 10 (the one that caused error)
            for i, row in enumerate(reader):
                if i == 8: # Line 10 (1-based) is index 8 after next(reader)
                    print(f"\nRow 10 (Index 8): {row}")
                    print(f"Column count: {len(row)}")
                    break
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_csv_headers()
