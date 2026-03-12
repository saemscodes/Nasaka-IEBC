import os, requests, json
from dotenv import load_dotenv
load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
h = {"apikey": key, "Authorization": f"Bearer {key}"}

r = requests.get(
    f"{url}/rest/v1/iebc_offices?select=id,constituency,county,latitude,longitude&order=id&limit=300",
    headers=h, timeout=30,
)
data = r.json()

dupes = {}
for o in data:
    k = f"{o.get('latitude','')},{o.get('longitude','')}"
    dupes.setdefault(k, []).append(o)

multi = [v for v in dupes.values() if len(v) > 1]

print(f"Total offices: {len(data)}")
print(f"Unique coords: {len(dupes)}")
print(f"Duplicate coord groups: {len(multi)}")
for v in multi[:20]:
    names = [f"{x['constituency']}/{x['county']}" for x in v]
    print(f"  ({v[0]['latitude']},{v[0]['longitude']}): {names}")
