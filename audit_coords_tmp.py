#!/usr/bin/env python3
"""Full IEBC coordinate audit against Supabase."""
import requests, json
from math import radians, cos, sin, sqrt, atan2

url = 'https://ftswzvqwxdwgkvfbwfpx.supabase.co'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3d6dnF3eGR3Z2t2ZmJ3ZnB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1NDU1MSwiZXhwIjoyMDY3OTMwNTUxfQ.939Uqckn6DsQ7J3-Ts9WiqOXFfiGF9uqmJT7kpgNbvE'
headers = {'apikey': key, 'Authorization': f'Bearer {key}'}
resp = requests.get(f'{url}/rest/v1/iebc_offices?select=id,constituency_name,county,latitude,longitude,office_location&order=county,constituency_name&limit=500', headers=headers)
offices = resp.json()
print(f'Total offices: {len(offices)}')

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    dlat = radians(lat2-lat1); dlon = radians(lon2-lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))

# Find clusters
clusters = []
for i, o1 in enumerate(offices):
    for j, o2 in enumerate(offices):
        if j <= i:
            continue
        d = haversine(o1['latitude'], o1['longitude'], o2['latitude'], o2['longitude'])
        if d < 100:
            c1 = o1['constituency_name']
            c2 = o2['constituency_name']
            county = o1['county']
            clusters.append((c1, c2, county, round(d, 1)))

print(f'\n=== CLUSTERED OFFICES (within 100m) ===')
for c in clusters:
    print(f'  {c[0]} <-> {c[1]} ({c[2]}) - {c[3]}m apart')

# Check Nairobi offices specifically
nairobi = [o for o in offices if o.get('county','').upper() in ('NAIROBI', 'NAIROBI CITY')]
print(f'\n=== NAIROBI OFFICES ({len(nairobi)}) ===')
for o in nairobi:
    loc = (o.get('office_location') or '')[:60]
    name = o['constituency_name']
    print(f'  {name}: ({o["latitude"]}, {o["longitude"]}) - {loc}')

# Check Ruiru specifically
ruiru = [o for o in offices if 'ruiru' in o.get('constituency_name','').lower()]
print(f'\n=== RUIRU ===')
for o in ruiru:
    name = o['constituency_name']
    loc = o.get('office_location', '')
    print(f'  {name}: ({o["latitude"]}, {o["longitude"]}) - {loc}')

# Check for offices outside Kenya bounding box
outside = [o for o in offices if not (-5.0 <= o['latitude'] <= 5.5 and 33.5 <= o['longitude'] <= 42.0)]
print(f'\n=== OUTSIDE KENYA ({len(outside)}) ===')
for o in outside:
    name = o['constituency_name']
    county = o['county']
    print(f'  {name} ({county}): ({o["latitude"]}, {o["longitude"]})')

# Haile Selassie check: offices near -1.2864, 36.8222 (original Starehe/IEBC HQ location)
haile_lat, haile_lon = -1.2864, 36.8222
print(f'\n=== OFFICES NEAR HAILE SELASSIE AVE (-1.2864, 36.8222) within 500m ===')
for o in offices:
    d = haversine(o['latitude'], o['longitude'], haile_lat, haile_lon)
    if d < 500:
        name = o['constituency_name']
        county = o['county']
        print(f'  {name} ({county}): ({o["latitude"]}, {o["longitude"]}) - {round(d,1)}m away')
