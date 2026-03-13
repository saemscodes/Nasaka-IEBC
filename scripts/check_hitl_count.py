
import requests
import os

SUPABASE_URL = "https://ftswzvqwxdwgkvfbwfpx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3d6dnF3eGR3Z2t2ZmJ3ZnB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1NDU1MSwiZXhwIjoyMDY3OTMwNTUxfQ.939Uqckn6DsQ7J3-Ts9WiqOXFfiGF9uqmJT7kpgNbvE"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def check_counts():
    print("Checking geocode_hitl_queue count...")
    resp = requests.get(f"{SUPABASE_URL}/rest/v1/geocode_hitl_queue?select=count", headers=HEADERS)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")

if __name__ == "__main__":
    check_counts()
