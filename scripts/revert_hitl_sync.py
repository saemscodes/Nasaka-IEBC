import requests
import os
from datetime import datetime, timedelta, timezone

SUPABASE_URL = "https://ftswzvqwxdwgkvfbwfpx.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3d6dnF3eGR3Z2t2ZmJ3ZnB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1NDU1MSwiZXhwIjoyMDY3OTMwNTUxfQ.939Uqckn6DsQ7J3-Ts9WiqOXFfiGF9uqmJT7kpgNbvE"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def revert():
    # Only target 'auto_resolved' entries from the audit run
    # These were the 195 entries
    url = f"{SUPABASE_URL}/rest/v1/geocode_hitl_queue?status=eq.auto_resolved&dismiss_reason=eq.Auto-archived: office already verified"
    
    # First, fetch them to confirm
    resp = requests.get(url, headers=HEADERS)
    if resp.status_code != 200:
        print(f"Error fetching: {resp.text}")
        return
    
    entries = resp.json()
    print(f"Found {len(entries)} entries to revert.")
    
    if not entries:
        return

    # Update them back to pending
    ids = [str(e["id"]) for e in entries]
    
    # Split into chunks to avoid long URL
    chunk_size = 50
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i:i+chunk_size]
        update_url = f"{SUPABASE_URL}/rest/v1/geocode_hitl_queue?id=in.({','.join(chunk)})"
        payload = {
            "status": "pending",
            "resolved_at": None,
            "dismiss_reason": None
        }
        resp = requests.patch(update_url, headers=HEADERS, json=payload)
        print(f"Chunk {i//chunk_size + 1} reverted: {resp.status_code}")

if __name__ == "__main__":
    revert()
