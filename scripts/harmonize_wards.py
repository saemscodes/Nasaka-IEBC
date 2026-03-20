#!/usr/bin/env python3
"""
Ward Harmonization & Office Linker (STRICT MODE)
-----------------------------------------------
1. Deduplicates 'wards' table based on (County, Constituency, Ward).
2. Aligns coordinates with official 'kenya_wards_centroids.json'.
3. Normalizes all names to Title Case.
4. Maps 'iebc_offices' to their respective wards via Name Match & Proximity.
"""

import os
import re
import json
import time
import math
import logging
import requests
from pathlib import Path
from dotenv import load_dotenv
from typing import Dict, List, Optional, Tuple

load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
CENTROID_JSON = Path("public/context/Wards/kenya_wards_centroids.json")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("harmonize_wards")

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = math.sin(d_lat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def normalize_name(name: str) -> str:
    """Normalize names to Title Case with IEBC-specific adjustments."""
    if not name: return ""
    n = name.strip().upper()
    n = n.replace("\u2019", "'").replace("\u2018", "'").replace("`", "'")
    # Fix common constituency suffixes
    n = re.sub(r"\s+SUB\s+COUNTY$", "", n)
    n = re.sub(r"\s+COUNTY$", "", n)
    # Title Case conversion
    parts = []
    for word in n.lower().split():
        if word in ("ii", "iii", "iv", "v"): # Handle Roman numerals
            parts.append(word.upper())
        elif "'" in word:
            subparts = word.split("'")
            parts.append("'".join(p.capitalize() for p in subparts))
        else:
            parts.append(word.capitalize())
    return " ".join(parts)

def get_official_centroids() -> List[Dict]:
    if not CENTROID_JSON.exists():
        log.error(f"Centroid file not found: {CENTROID_JSON}")
        return []
    with open(CENTROID_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
        log.info(f"Loaded {len(data)} official ward centroids.")
        return data

def fetch_supabase_table(table: str) -> List[Dict]:
    log.info(f"Fetching '{table}' from Supabase...")
    items = []
    offset = 0
    limit = 1000
    while True:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/{table}?select=*&limit={limit}&offset={offset}",
            headers=HEADERS, timeout=30
        )
        resp.raise_for_status()
        data = resp.json()
        items.extend(data)
        if len(data) < limit:
            break
        offset += limit
    log.info(f"  Total {len(items)} records retrieved.")
    return items

def harmonize():
    official_centroids = get_official_centroids()
    db_wards = fetch_supabase_table("wards")
    db_offices = fetch_supabase_table("iebc_offices")

    # 1. Index Official Centroids by (County, Constituency, Ward Name)
    official_map = {}
    for c in official_centroids:
        county = normalize_name(c["county"]).upper()
        const = normalize_name(c["constituency"]).upper()
        ward = normalize_name(c["name"]).upper()
        key = (county, const, ward)
        official_map[key] = c

    log.info(f"Indexed {len(official_map)} unique official keys.")

    # 2. Process DB Wards
    db_indexed = {}
    dupes_to_delete = []
    
    for w in db_wards:
        county = normalize_name(w["county"]).upper()
        const = normalize_name(w["constituency"]).upper()
        ward = normalize_name(w["ward_name"]).upper()
        key = (county, const, ward)
        
        if key not in db_indexed:
            db_indexed[key] = w
        else:
            # We already have a primary record for this key
            primary = db_indexed[key]
            # Merge counts if possible
            new_target = max(w.get("registration_target") or 0, primary.get("registration_target") or 0)
            primary["registration_target"] = new_target
            dupes_to_delete.append(w["id"])

    log.info(f"Found {len(dupes_to_delete)} duplicate ward records in DB.")

    # 3. Update DB Ward alignment
    wards_to_patch = []
    for key, w in db_indexed.items():
        official = official_map.get(key)
        
        # Determine Title Case display names
        title_ward = normalize_name(w["ward_name"])
        title_const = normalize_name(w["constituency"])
        title_county = normalize_name(w["county"])
        
        payload = {
            "ward_name": title_ward,
            "constituency": title_const,
            "county": title_county,
            "updated_at": "now()"
        }
        
        if official:
            payload["latitude"] = official["lat"]
            payload["longitude"] = official["lng"]
            payload["total_voters"] = official.get("pop", w.get("registration_target", 0))
            payload["geocode_verified"] = True
            payload["geocode_status"] = "verified_centroid"
        
        wards_to_patch.append((w["id"], payload))

    # 4. Link Offices to Wards
    offices_to_patch = []
    # Build spatial index for wards by constituency
    wards_by_const = {}
    for key, w in db_indexed.items():
        const = key[1]
        wards_by_const.setdefault(const, []).append(w)

    log.info("Linking offices to wards...")
    for o in db_offices:
        const = normalize_name(o["constituency"]).upper()
        candidates = wards_by_const.get(const, [])
        
        if not candidates:
            continue
            
        best_ward = None
        # Mode A: Try Name Matching in Office Location
        loc_text = (o.get("office_location") or "").upper()
        for cand in candidates:
            if cand["ward_name"].upper() in loc_text:
                best_ward = cand
                break
        
        # Mode B: Proximity matching if we have office coordinates
        if not best_ward and o.get("latitude") and o.get("longitude"):
            min_dist = float('inf')
            for cand in candidates:
                if cand.get("latitude") and cand.get("longitude"):
                    dist = haversine(float(o["latitude"]), float(o["longitude"]), 
                                    float(cand["latitude"]), float(cand["longitude"]))
                    if dist < min_dist:
                        min_dist = dist
                        best_ward = cand
            
            # Use safety threshold: ward centroids can be far, but within constituency it's usually < 20km
            if min_dist > 20: 
                best_ward = None
        
        if best_ward:
            offices_to_patch.append((o["id"], {
                "ward": best_ward["ward_name"],
                "ward_id": best_ward["id"]
            }))

    log.info(f"Linked {len(offices_to_patch)} offices to wards.")

    # 5. EXECUTION PHASE (STRICT MODE)
    if dupes_to_delete:
        log.info(f"Deleting duplicates ({len(dupes_to_delete)})...")
        # Chunk deletes
        for i in range(0, len(dupes_to_delete), 50):
            batch_ids = dupes_to_delete[i:i+50]
            ids_param = ",".join(batch_ids)
            resp = requests.delete(f"{SUPABASE_URL}/rest/v1/wards?id=in.({ids_param})", headers=HEADERS)
            if resp.status_code >= 400:
                log.error(f"  Delete failed: {resp.text}")

    # Check for new columns in DB before pushing
    wards_cols = requests.get(f"{SUPABASE_URL}/rest/v1/wards?limit=0", headers=HEADERS).headers.get("Content-Range", "")
    # Actually, let's just try a small patch to see what works
    sample_payload = wards_to_patch[0][1] if wards_to_patch else {}
    test_resp = requests.patch(f"{SUPABASE_URL}/rest/v1/wards?id=eq.{wards_to_patch[0][0]}", 
                              headers={**HEADERS, "Prefer": "return=minimal"}, 
                              json=sample_payload)
    
    has_total_voters = test_resp.status_code < 400
    if not has_total_voters:
        log.warning("Table 'wards' seems missing 'total_voters' or other new columns. Stripping payload...")
        for _, p in wards_to_patch:
            p.pop("total_voters", None)
            p.pop("geocode_verified", None)
            p.pop("geocode_status", None)

    log.info(f"Patching {len(wards_to_patch)} wards in batches of 50...")
    for i in range(0, len(wards_to_patch), 50):
        batch = wards_to_patch[i:i+50]
        # For patching multiple IDs with different data, we use upsert with IDs
        upsert_payload = []
        for wid, p in batch:
            p["id"] = wid
            upsert_payload.append(p)
        
        resp = requests.post(f"{SUPABASE_URL}/rest/v1/wards", 
                             headers={**HEADERS, "Prefer": "resolution=merge-duplicates"}, 
                             json=upsert_payload)
        if resp.status_code >= 400:
            log.error(f"  Ward batch {i//50} failed: {resp.text}")

    # Office Check
    test_office_resp = requests.patch(f"{SUPABASE_URL}/rest/v1/iebc_offices?id=eq.{offices_to_patch[0][0]}",
                                     headers={**HEADERS, "Prefer": "return=minimal"},
                                     json=offices_to_patch[0][1])
    has_ward_id = test_office_resp.status_code < 400
    
    if not has_ward_id:
        log.warning("Table 'iebc_offices' seems missing 'ward' or 'ward_id' columns. Skipping office link update.")
    else:
        log.info(f"Patching {len(offices_to_patch)} offices in batches of 50...")
        for i in range(0, len(offices_to_patch), 50):
            batch = offices_to_patch[i:i+50]
            upsert_payload = []
            for oid, p in batch:
                p["id"] = oid
                upsert_payload.append(p)
            
            resp = requests.post(f"{SUPABASE_URL}/rest/v1/iebc_offices",
                                 headers={**HEADERS, "Prefer": "resolution=merge-duplicates"},
                                 json=upsert_payload)
            if resp.status_code >= 400:
                log.error(f"  Office batch {i//50} failed: {resp.text}")

    log.info("Harmonization Complete.")

if __name__ == "__main__":
    harmonize()
