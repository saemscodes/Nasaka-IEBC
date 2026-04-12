
import os
import requests
import json
from datetime import datetime, timezone

# Nasaka Log Reconstructor v1.0
SUPABASE_URL = "https://ftswzvqwxdwgkvfbwfpx.supabase.co"
SUPABASE_KEY = "[REPLACE_WITH_SERVICE_ROLE_KEY]" # Loaded via .env below
TARGET_LOG = r"d:\CEKA\NASAKA\v005\logs\geocode_run_v10.8.1.log"

def load_keys():
    from dotenv import load_dotenv
    load_dotenv()
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def reconstruct():
    key = load_keys()
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    
    # Fetch audit records since 00:30 UTC today
    # Adjusting for Kenya time (UTC+3)
    since_utc = "2026-04-07T21:30:00Z" 
    url = f"{SUPABASE_URL}/rest/v1/geocode_audit?created_at=gt.{since_utc}&order=created_at.asc"
    
    print(f"Querying {url}...")
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        print(f"Error: {resp.status_code} - {resp.text}")
        return
    
    records = resp.json()
    print(f"Found {len(records)} records to reconstruct.")
    
    with open(TARGET_LOG, "a", encoding="utf-8") as f:
        f.write("\n--- [GROUND TRUTH RECONSTRUCTION: 14:00 PM] ---\n")
        f.write("# Reconstructing missing telemetry from geocode_audit table\n")
        
        for r in records:
            ts = r["created_at"].replace("T", " ").split(".")[0]
            office_id = r["office_id"]
            constituency = r.get("constituency", "Unknown")
            county = r.get("county", "Unknown")
            issue = r.get("issue_type", "RESOLVED")
            conf = r.get("census_confidence") or r.get("consensus_confidence", 0.0)
            lat, lng = r["new_latitude"], r["new_longitude"]
            
            log_line = f"{ts} [INFO] [{office_id}] {constituency} ({county}) - {issue}: ({lat}, {lng}) conf={conf}\n"
            f.write(log_line)
            
        f.write("--- [END OF RECONSTRUCTION] ---\n")

if __name__ == "__main__":
    reconstruct()
