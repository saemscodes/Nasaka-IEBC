import requests
import json
import math
import os

SUPABASE_URL = "https://ftswzvqwxdwgkvfbwfpx.supabase.co/rest/v1/iebc_offices"
API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3d6dnF3eGR3Z2t2ZmJ3ZnB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTQ1NTEsImV4cCI6MjA2NzkzMDU1MX0.ZRYkA2uRUEG1M6zLpMI0waaprBORCl_sYQ8l3orhdUo"

def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371000 # meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def audit():
    headers = {
        "apikey": API_KEY,
        "Authorization": f"Bearer {API_KEY}"
    }
    
    # List of constituencies mentioned by the user
    target_constituencies = [
        "Westlands", "Dagoretti", "Langata", "Kibra", "Roysambu", 
        "Kasarani", "Ruaraka", "Embakasi South", "Embakasi North", 
        "Embakasi Central", "Embakasi East", "Embakasi West", 
        "Kamukunji", "Mathare", "Ruiru"
    ]
    
    print("Fetching IEBC Offices from Supabase...")
    response = requests.get(SUPABASE_URL + "?select=*", headers=headers)
    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        return

    offices = response.json()
    print(f"Total offices found: {len(offices)}")

    matched_offices = []
    coordinate_map = {}

    for office in offices:
        name = office.get('constituency_name') or ""
        loc = office.get('office_location') or ""
        full_text = f"{name} {loc} {office.get('county', '')}".lower()
        
        lat = office.get('latitude')
        lng = office.get('longitude')
        
        is_target = any(tc.lower() in full_text for tc in target_constituencies)
        
        if is_target:
            matched_offices.append(office)
            
        if lat and lng:
            coord_key = (round(lat, 5), round(lng, 5))
            if coord_key not in coordinate_map:
                coordinate_map[coord_key] = []
            coordinate_map[coord_key].append(office.get('constituency_name') or loc)

    print("\n--- TARGET OFFICE REPORT ---")
    for office in matched_offices:
        print(f"[{office.get('county')}] {office.get('constituency_name')}")
        print(f"  Location: {office.get('office_location')}")
        print(f"  Coords:   {office.get('latitude')}, {office.get('longitude')}")
        print(f"  Verified: {office.get('verified')}")
        print("-" * 20)

    print("\n--- CLUSTERING REPORT (Identical Coordinates) ---")
    for coords, names in coordinate_map.items():
        if len(names) > 3:
            print(f"Coords {coords}: {len(names)} offices")
            print(f"  Names: {', '.join(names[:10])}...")

if __name__ == "__main__":
    audit()
