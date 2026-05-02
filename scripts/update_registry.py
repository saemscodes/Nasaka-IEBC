import os, csv, psycopg2, re
from dotenv import load_dotenv

def normalize_spaces(text):
    if not text: return ""
    return re.sub(r'\s+', ' ', text.strip())

def update_registry():
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    csv_path = "data/verified_scraped_coordinates.csv"
    
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return
        
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    count = 0
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('VERIFIABILITY') != 'HIGH':
                continue
                
            val_lat = row['LAT']
            val_lng = row['LNG']
            val_conf = row['CONFIDENCE_SCORE']
            
            # Normalize names to handle double-space issues
            val_name = normalize_spaces(row['NAME'])
            val_county = normalize_spaces(row['COUNTY'])
            val_constituency = normalize_spaces(row['CONSTITUENCY'])
            
            print(f"Applying: {val_name} ({val_constituency}, {val_county})")
            
            # office_location is the correct column name in iebc_offices
            cur.execute("""
                UPDATE public.iebc_offices 
                SET latitude = %s, 
                    longitude = %s, 
                    geocode_confidence = %s,
                    geocode_status = 'verified',
                    geocode_method = 'google_maps_scraper_v13.2',
                    verified = true,
                    updated_at = NOW()
                WHERE office_location ILIKE %s 
                  AND (county ILIKE %s OR county ILIKE %s)
                  AND (constituency ILIKE %s OR constituency_name ILIKE %s)
                  AND office_type = 'REGISTRATION_CENTRE'
            """, (val_lat, val_lng, val_conf, val_name, val_county, f"%{val_county}%", val_constituency, f"%{val_constituency}%"))
            
            if cur.rowcount > 0:
                count += cur.rowcount
                print(f"  + Success: Updated {cur.rowcount} row(s).")
            else:
                # Fallback for slightly different naming
                print(f"  x No match found.")
                
    conn.commit()
    print(f"\nSuccessfully updated {count} registration centres in iebc_offices.")
    conn.close()

if __name__ == "__main__": update_registry()
