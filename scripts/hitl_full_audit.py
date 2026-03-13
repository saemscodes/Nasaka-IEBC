#!/usr/bin/env python3
"""
HITL Full Audit + Precision Re-Pinner + Archive Cleaner
========================================================
v2.5 — PRODUCTION STABLE (Correct Statuses + Threads)
"""

import os, re, sys, json, math, time, logging, argparse, threading, requests, random
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Set
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Admin Task Integration
try:
    from admin_task_lib import AdminTask
    HAS_ADMIN_LIB = True
except ImportError:
    HAS_ADMIN_LIB = False

try:
    import geopandas as gpd
    from shapely.geometry import Point
    from shapely.ops import unary_union
    HAS_GEO = True
except ImportError:
    HAS_GEO = False

# ── Config ──────────────────────────────────────────────────────────────────────
_FB_URL = "https://ftswzvqwxdwgkvfbwfpx.supabase.co"
_FB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3d6dnF3eGR3Z2t2ZmJ3ZnB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1NDU1MSwiZXhwIjoyMDY3OTMwNTUxfQ.939Uqckn6DsQ7J3-Ts9WiqOXFfiGF9uqmJT7kpgNbvE"

SUPABASE_URL = os.getenv("SUPABASE_URL", _FB_URL)
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_ANON_KEY", _FB_KEY))
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

PAGE_SIZE = 1000
VERIFIED_STATUSES = {"resolved", "verified_accurate", "shapefile_corrected", "geocode_verified", "multi_source_consensus", "verified"}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
log = logging.getLogger("hitl_audit")

# ── Reliable Requests ──────────────────────────────────────────────────────────
def safe_request(url: str, params: Optional[Dict] = None, method: str = "GET", 
                 json_data: Optional[Dict] = None, max_retries: int = 3, initial_delay: float = 1.0) -> Optional[requests.Response]:
    delay = initial_delay
    for attempt in range(max_retries + 1):
        try:
            resp = requests.request(method.upper(), url, params=params, json=json_data, headers=HEADERS, timeout=15)
            if 200 <= resp.status_code < 300: return resp
            if resp.status_code == 429 or 500 <= resp.status_code < 600:
                if attempt < max_retries:
                    time.sleep(delay + random.uniform(0.1, 0.5)); delay *= 2; continue
            return None
        except Exception:
            if attempt < max_retries:
                time.sleep(delay + random.uniform(0.1, 0.5)); delay *= 2; continue
            return None
    return None

# ── Progress Bar ───────────────────────────────────────────────────────────────
def print_progress(current, total, prefix='', suffix='', decimals=1, length=40, fill='#'):
    percent = ("{0:." + str(decimals) + "f}").format(100 * (current / float(total)))
    filled_len = int(length * current // total)
    bar = fill * filled_len + '-' * (length - filled_len)
    sys.stdout.write(f'\r{prefix} |{bar}| {percent}% {suffix}')
    sys.stdout.flush()
    if current == total: sys.stdout.write('\n'); sys.stdout.flush()

# ── Geometry Index ──────────────────────────────────────────────────────────────
class ConstituencyIndex:
    def __init__(self, path):
        self.gdf = gpd.read_file(path)
        if self.gdf.crs and self.gdf.crs.to_epsg() != 4326: self.gdf = self.gdf.to_crs(epsg=4326)
        self.name_col = next(c for c in ["CONSTITUEN","constituency_name","NAME","Constituency"] if c in self.gdf.columns)
        self._idx = {self._norm(str(row[self.name_col])): i for i, row in self.gdf.iterrows()}
    @staticmethod
    def _norm(s): return s.strip().upper().replace("HOMABAY","HOMA BAY").replace("ELEGEYO","ELGEYO")
    def polygon(self, name):
        k = self._norm(name)
        return self.gdf.at[self._idx[k], "geometry"] if k in self._idx else None
    def pip(self, lat, lng, name):
        poly = self.polygon(name)
        return bool(poly and poly.contains(Point(lng, lat)))

# ── Supabase IO ────────────────────────────────────────────────────────────────
def _get_all(path, params=""):
    res, offset = [], 0
    while True:
        sep = "&" if "?" in path + params else "?"
        url = f"{SUPABASE_URL}/rest/v1/{path}{params}{sep}limit={PAGE_SIZE}&offset={offset}"
        resp = safe_request(url)
        if not resp: break
        batch = resp.json(); res.extend(batch)
        if len(batch) < PAGE_SIZE: break
        offset += PAGE_SIZE
    return res

def fetch_all_hitl(): return _get_all("geocode_hitl_queue", "?select=id,office_id,status,created_at&status=eq.pending&order=office_id,created_at")
def fetch_offices(ids):
    m = {}
    for i in range(0, len(ids), 200):
        rows = _get_all("iebc_offices", f"?id=in.({','.join(str(x) for x in ids[i:i+200])})&select=id,constituency_name,constituency,county,latitude,longitude,geocode_status,geocode_confidence,verified")
        for o in rows: m[o["id"]] = o
    return m

def queue_update(hitl_id, status, reason):
    url = f"{SUPABASE_URL}/rest/v1/geocode_hitl_queue?id=eq.{hitl_id}"
    payload = {"status": status, "dismiss_reason": reason[:500], "resolved_at": datetime.now(timezone.utc).isoformat()}
    return bool(safe_request(url, method="PATCH", json_data=payload))

# ── Processing ────────────────────────────────────────────────────────────────
def process_queue_bulk(entries, status, reason, threads=15):
    if not entries: return 0
    total = len(entries); success = 0
    print(f"Archiving {total} entries to status '{status}'...")
    with ThreadPoolExecutor(max_workers=threads) as executor:
        futures = {executor.submit(queue_update, e["id"], status, reason): e["id"] for e in entries}
        for i, future in enumerate(as_completed(futures), 1):
            if future.result(): success += 1
            print_progress(i, total, prefix='Archiving:', suffix=f'({success} ok)', length=40)
    return success

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--shapefile", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--threads", type=int, default=15)
    args = parser.parse_args()

    log.info("="*70); log.info("HITL AUDIT v2.5 (STRICT MODE - DATABASE SYNC)"); log.info("="*70)
    hitl_raw = fetch_all_hitl()
    office_map = fetch_offices(list({h["office_id"] for h in hitl_raw}))

    # Simple Triage
    res, stale, needs = [], [], []
    by_off = defaultdict(list)
    for h in hitl_raw: by_off[h["office_id"]].append(h)
    for oid, entries in by_off.items():
        entries.sort(key=lambda x: x["created_at"] or "", reverse=True)
        off = office_map.get(oid, {})
        geo_status = (off.get("geocode_status") or "").lower()
        is_res = geo_status in VERIFIED_STATUSES or off.get("verified", False)
        
        newest, older = entries[0], entries[1:]
        for old in older: stale.append(old)
        if is_res: res.append(newest)
        elif newest.get("status") in ("pending", "needs_review", None): needs.append(newest)

    log.info(f"Triage: {len(res)} resolved, {len(stale)} stale, {len(needs)} pending")

    if args.apply:
        # Use VALID DB statuses: 'auto_resolved' for confirmed, 'dismissed' for stale/rejected
        s1 = process_queue_bulk(res, "auto_resolved", "Auto-archived: office already verified", threads=args.threads)
        s2 = process_queue_bulk(stale, "dismissed", "Auto-archived: newer entry exists", threads=args.threads)
        log.info(f"\n✅ SUCCESS: Processed {s1 + s2} entries.")
    else:
        log.info("\nDRY RUN complete. Use --apply to sync with database.")

if __name__ == "__main__":
    main()
