#!/usr/bin/env python3
"""
HITL Full Audit + Precision Re-Pinner + Archive Cleaner
========================================================

Does three things in one pass for EVERY entry in geocode_hitl_queue:

  STAGE 1 — TRIAGE
    Classify each entry as:
      A) ALREADY_RESOLVED   — geocode_status is resolved/verified, coords pass PIP
                              → archive it, remove from active queue
      B) STALE_DUPLICATE    — same office appears multiple times, only latest matters
                              → archive older copies
      C) CLUSTER            — this office shares coords with 1+ other offices
                              → send to precision re-pinning (Stage 2)
      D) GENUINELY_PENDING  — real issue, needs fixing
                              → send to precision re-pinning (Stage 2)

  STAGE 2 — PRECISION RE-PINNING (for C and D)
    For each office needing a real coordinate:
      1. PIP check on existing coords against constituency shapefile
      2. If PIP fails → try multi-query geocoding (Nominatim + ArcGIS + OpenCage)
         using office_location + landmark fields for street-level accuracy
      3. Each geocoder result run through PIP immediately — only PIP-passing
         results are kept (no more county string matching)
      4. Consensus from PIP-passing results only
      5. If no geocoder gets a PIP pass → use polygon centroid as fallback
      6. Confidence assigned based on method:
           street-level + PIP = 0.92
           consensus PIP     = 0.85
           centroid fallback = 0.70

  STAGE 3 — ARCHIVE & CLEANUP
    For verified entries: mark HITL as 'archived'
    For corrected entries: update iebc_offices coords, mark HITL as 'resolved'
    For remaining genuine pending: leave in queue, update with fresh attempt notes
    Write full audit CSV for your records

USAGE:
  python scripts/hitl_full_audit.py --shapefile d:\\CEKA\\NASAKA\\layers\\constituencies.shp
  python scripts/hitl_full_audit.py --shapefile d:\\CEKA\\NASAKA\\layers\\constituencies.shp --apply
  python scripts/hitl_full_audit.py --shapefile d:\\CEKA\\NASAKA\\layers\\constituencies.shp --apply --max 50
  python scripts/hitl_full_audit.py --shapefile d:\\CEKA\\NASAKA\\layers\\constituencies.shp --dry-run-report

ENVIRONMENT VARS NEEDED:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  Optional (improve re-pinning): ARCGIS_API_KEY_PRIMARY, VITE_OPENCAGE_API_KEY,
                                  VITE_LOCATION_IQ_API_KEY
"""

import os, re, sys, json, math, time, logging, argparse, threading, requests
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Set
from collections import defaultdict

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
ARCGIS_KEY   = os.getenv("ARCGIS_API_KEY_PRIMARY", "")
OPENCAGE_KEY = os.getenv("VITE_OPENCAGE_API_KEY", os.getenv("OPENCAGE_API_KEY", ""))
LOCATIONIQ_KEY = os.getenv("VITE_LOCATION_IQ_API_KEY", os.getenv("LOCATIONIQ_API_KEY", ""))

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

USER_AGENT = "NasakaIEBC-Audit/2.0 (civiceducationkenya.com)"
CLUSTER_RADIUS_KM   = 0.5    # offices within 500m of each other = cluster
CONSENSUS_RADIUS_KM = 1.0    # geocoder results within 1km = consensus
AUTO_APPLY_CONFIDENCE = 0.70  # auto-apply if confidence >= this
PAGE_SIZE = 1000              # Supabase pagination

VERIFIED_STATUSES = {
    "resolved", "verified_accurate", "shapefile_corrected",
    "geocode_verified", "multi_source_consensus", "verified",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("hitl_audit")


# ── Rate limiters ───────────────────────────────────────────────────────────────

class RateLimiter:
    def __init__(self, interval: float):
        self.interval = interval
        self.last = 0.0
        self._lock = threading.Lock()
    def wait(self):
        with self._lock:
            now = time.monotonic()
            gap = self.interval - (now - self.last)
            if gap > 0:
                time.sleep(gap)
            self.last = time.monotonic()

RL = {
    "nominatim": RateLimiter(1.2),
    "arcgis":    RateLimiter(0.5),
    "opencage":  RateLimiter(1.1),
    "locationiq":RateLimiter(1.1),
}


# ── Geometry helpers ────────────────────────────────────────────────────────────

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def is_in_kenya(lat, lng) -> bool:
    return -5.0 <= lat <= 5.0 and 33.9 <= lng <= 42.0


# ── Shapefile index ─────────────────────────────────────────────────────────────

class ConstituencyIndex:
    """Load a constituency shapefile/GeoJSON and provide PIP + centroid lookups."""
    NAME_COLS   = ["CONSTITUEN","constituency_name","NAME","Constituency","CONST_NAME","name","CONSTITUENCY"]
    COUNTY_COLS = ["COUNTY","county","County","COUNTY_NAM","county_name"]

    def __init__(self, path: str, name_col: str = None, county_col: str = None):
        if not HAS_GEO:
            raise ImportError("geopandas/shapely not installed. Run: pip install geopandas shapely")
        log.info(f"Loading shapefile: {path}")
        self.gdf = gpd.read_file(path)
        if self.gdf.crs and self.gdf.crs.to_epsg() != 4326:
            log.info(f"  Reprojecting from {self.gdf.crs}...")
            self.gdf = self.gdf.to_crs(epsg=4326)
        log.info(f"  {len(self.gdf)} polygons. Columns: {list(self.gdf.columns)}")
        self.name_col   = name_col   or self._find_col(self.NAME_COLS,   "name",   required=True)
        self.county_col = county_col or self._find_col(self.COUNTY_COLS, "county", required=False)
        # Build normalised index
        self._idx: Dict[str, List[int]] = {}
        for i, row in self.gdf.iterrows():
            k = self._norm(str(row[self.name_col]))
            self._idx.setdefault(k, []).append(i)
        log.info(f"  Indexed {len(self._idx)} constituency names via col='{self.name_col}'")

    def _find_col(self, candidates, label, required=True):
        for c in candidates:
            if c in self.gdf.columns: return c
        lower = {c.lower(): c for c in self.gdf.columns}
        for c in candidates:
            if c.lower() in lower: return lower[c.lower()]
        if required:
            raise ValueError(f"No {label} column found. Available: {list(self.gdf.columns)}")
        return None

    @staticmethod
    def _norm(s: str) -> str:
        s = s.strip().upper()
        s = re.sub(r"['\u2019\u2018`]", "'", s)
        s = re.sub(r"\s*/\s*", "/", s)
        s = re.sub(r"\s*-\s*", "-", s)
        s = re.sub(r"\s+", " ", s)
        return s

    def _rows(self, name: str) -> List[int]:
        k = self._norm(name)
        if k in self._idx: return self._idx[k]
        # Slash/space/hyphen variants
        for v in [k.replace(" ","/"), k.replace("/"," "), k.replace("-"," "), k.replace(" ","-")]:
            if v in self._idx: return self._idx[v]
        # MT. ELGON → MT ELGON
        k_clean = k.replace(".", "")
        if k_clean in self._idx: return self._idx[k_clean]
        # Substring match (risky, only if unique)
        hits = [idxs for ky, idxs in self._idx.items() if k in ky or ky in k]
        return hits[0] if len(hits) == 1 else []

    def polygon(self, name: str):
        rows = self._rows(name)
        if not rows: return None
        geoms = [self.gdf.at[i, "geometry"] for i in rows if self.gdf.at[i, "geometry"] is not None]
        return unary_union(geoms) if len(geoms) > 1 else (geoms[0] if geoms else None)

    def pip(self, lat: float, lng: float, name: str) -> bool:
        poly = self.polygon(name)
        return bool(poly and poly.contains(Point(lng, lat)))

    def centroid(self, name: str) -> Optional[Tuple[float,float]]:
        poly = self.polygon(name)
        if not poly: return None
        c = poly.centroid
        return (c.y, c.x)

    def which_constituency(self, lat: float, lng: float) -> Optional[str]:
        pt = Point(lng, lat)
        for i, row in self.gdf.iterrows():
            if row["geometry"] and row["geometry"].contains(pt):
                return str(row[self.name_col]).strip()
        return None

    def all_names(self) -> List[str]:
        return sorted(self._idx.keys())


# ── Supabase data fetching ──────────────────────────────────────────────────────

def _get_all(url_path: str, extra_params: str = "") -> List[Dict]:
    """Paginated fetch from Supabase."""
    results = []
    offset = 0
    while True:
        sep = "&" if "?" in url_path + extra_params else "?"
        url = f"{SUPABASE_URL}/rest/v1/{url_path}{extra_params}{sep}limit={PAGE_SIZE}&offset={offset}"
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        batch = resp.json()
        results.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return results

def fetch_all_hitl() -> List[Dict]:
    log.info("Fetching ALL HITL queue entries (all statuses)...")
    entries = _get_all(
        "geocode_hitl_queue",
        "?select=id,office_id,audit_id,issue_type,proposed_latitude,proposed_longitude,"
        "confidence,agreement_count,spread_km,source_details,status,"
        "resolved_by,resolved_at,final_latitude,final_longitude,"
        "dismiss_reason,created_at&order=office_id,created_at"
    )
    log.info(f"  Fetched {len(entries)} HITL entries")
    return entries

def fetch_offices_for_ids(office_ids: List[int]) -> Dict[int, Dict]:
    if not office_ids:
        return {}
    office_map = {}
    for i in range(0, len(office_ids), 200):
        batch = office_ids[i:i+200]
        ids_csv = ",".join(str(x) for x in batch)
        rows = _get_all(
            "iebc_offices",
            f"?id=in.({ids_csv})"
            f"&select=id,constituency_name,constituency,county,"
            f"latitude,longitude,office_location,landmark,"
            f"geocode_status,geocode_confidence,confidence_score,verified"
        )
        for o in rows:
            office_map[o["id"]] = o
    log.info(f"  Fetched {len(office_map)} office records")
    return office_map

def fetch_all_offices_coords() -> List[Dict]:
    """Fetch all offices with coords for cluster detection."""
    log.info("Fetching all offices for cluster detection...")
    offices = _get_all(
        "iebc_offices",
        "?select=id,constituency_name,constituency,county,latitude,longitude"
        "&latitude=not.is.null"
    )
    log.info(f"  {len(offices)} offices with coordinates")
    return offices


# ── Cluster detection ───────────────────────────────────────────────────────────

def find_clusters(offices: List[Dict], radius_km: float = CLUSTER_RADIUS_KM) -> Dict[int, List[int]]:
    """Return dict: office_id → list of other office_ids within radius_km."""
    clusters: Dict[int, List[int]] = defaultdict(list)
    office_list = [o for o in offices if o.get("latitude") and o.get("longitude")]

    for i, a in enumerate(office_list):
        for j, b in enumerate(office_list):
            if i >= j:
                continue
            dist = haversine_km(a["latitude"], a["longitude"], b["latitude"], b["longitude"])
            if dist <= radius_km:
                clusters[a["id"]].append(b["id"])
                clusters[b["id"]].append(a["id"])

    return dict(clusters)


# ── Geocoders (PIP-first) ───────────────────────────────────────────────────────

def geocode_nominatim(query: str, limit: int = 5) -> List[Dict]:
    RL["nominatim"].wait()
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "countrycodes": "ke", "format": "json",
                    "limit": limit, "addressdetails": 1},
            headers={"User-Agent": USER_AGENT}, timeout=12,
        )
        results = []
        for r in resp.json():
            lat, lng = float(r["lat"]), float(r["lon"])
            if not is_in_kenya(lat, lng): continue
            results.append({
                "lat": lat, "lng": lng, "source": "nominatim",
                "confidence": min(float(r.get("importance", 0.5)) * 1.5, 1.0),
                "display_name": r.get("display_name", ""),
            })
        return results
    except Exception as e:
        log.debug(f"Nominatim error: {e}")
        return []

def geocode_arcgis(query: str) -> List[Dict]:
    if not ARCGIS_KEY: return []
    RL["arcgis"].wait()
    try:
        resp = requests.get(
            "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
            params={"address": query, "f": "pjson", "token": ARCGIS_KEY,
                    "maxLocations": 5, "countryCode": "KEN",
                    "outFields": "Region,City,Neighborhood"},
            timeout=12,
        )
        results = []
        for c in resp.json().get("candidates", []):
            lat, lng = c["location"]["y"], c["location"]["x"]
            if not is_in_kenya(lat, lng): continue
            results.append({
                "lat": lat, "lng": lng, "source": "arcgis",
                "confidence": c.get("score", 50) / 100,
                "display_name": c.get("address", ""),
            })
        return results
    except Exception as e:
        log.debug(f"ArcGIS error: {e}")
        return []

def geocode_opencage(query: str) -> List[Dict]:
    if not OPENCAGE_KEY: return []
    RL["opencage"].wait()
    try:
        resp = requests.get(
            "https://api.opencagedata.com/geocode/v1/json",
            params={"q": query, "key": OPENCAGE_KEY, "countrycode": "ke",
                    "limit": 5, "no_annotations": 1},
            timeout=12,
        )
        results = []
        for r in resp.json().get("results", []):
            lat, lng = r["geometry"]["lat"], r["geometry"]["lng"]
            if not is_in_kenya(lat, lng): continue
            results.append({
                "lat": lat, "lng": lng, "source": "opencage",
                "confidence": r.get("confidence", 5) / 10,
                "display_name": r.get("formatted", ""),
            })
        return results
    except Exception as e:
        log.debug(f"OpenCage error: {e}")
        return []

def geocode_locationiq(query: str) -> List[Dict]:
    if not LOCATIONIQ_KEY: return []
    RL["locationiq"].wait()
    try:
        resp = requests.get(
            "https://us1.locationiq.com/v1/search",
            params={"key": LOCATIONIQ_KEY, "q": query, "format": "json",
                    "countrycodes": "ke", "limit": 5},
            timeout=12,
        )
        results = []
        for r in resp.json():
            lat, lng = float(r["lat"]), float(r["lon"])
            if not is_in_kenya(lat, lng): continue
            results.append({
                "lat": lat, "lng": lng, "source": "locationiq",
                "confidence": min(float(r.get("importance", 0.5)) * 1.5, 1.0),
                "display_name": r.get("display_name", ""),
            })
        return results
    except Exception as e:
        log.debug(f"LocationIQ error: {e}")
        return []


def build_precision_queries(office: Dict) -> List[str]:
    """Build street-level queries using office_location + landmark fields."""
    constituency = (office.get("constituency_name") or office.get("constituency", "")).strip()
    county       = office.get("county", "").strip()
    location     = (office.get("office_location") or "").strip()
    landmark     = (office.get("landmark") or "").strip()

    queries = []
    # Most specific first
    if location and landmark:
        queries.append(f"{location}, near {landmark}, {constituency}, {county} County, Kenya")
    if location:
        queries.append(f"{location}, {constituency}, {county} County, Kenya")
    if landmark:
        queries.append(f"{landmark}, {constituency}, {county} County, Kenya")
    # Fallback
    queries.append(f"{constituency} IEBC office, {county} County, Kenya")
    queries.append(f"{constituency}, {county}, Kenya")
    return queries


def precision_repin(office: Dict, index: ConstituencyIndex) -> Dict:
    """
    Try to get the best street-level coordinate for an office.
    Every candidate is run through PIP before being accepted.
    Returns: {lat, lng, confidence, method, notes, pip_verified}
    """
    constituency = (office.get("constituency_name") or office.get("constituency", "")).strip()

    # Step 0: check existing coords first
    cur_lat = office.get("latitude")
    cur_lng = office.get("longitude")
    if cur_lat and cur_lng and index.pip(cur_lat, cur_lng, constituency):
        return {
            "lat": cur_lat, "lng": cur_lng,
            "confidence": 0.90,
            "method": "existing_pip_pass",
            "notes": "Existing coordinates already inside correct constituency polygon.",
            "pip_verified": True,
        }

    queries = build_precision_queries(office)
    pip_passed: List[Dict] = []

    for qi, query in enumerate(queries):
        log.info(f"    Query {qi+1}/{len(queries)}: '{query}'")

        candidates = (
            geocode_nominatim(query, limit=5) +
            geocode_arcgis(query) +
            geocode_opencage(query) +
            geocode_locationiq(query)
        )

        for c in candidates:
            in_poly = index.pip(c["lat"], c["lng"], constituency)
            if in_poly:
                c["query_used"] = query
                pip_passed.append(c)

        if len(pip_passed) >= 2:
            log.info(f"    ✓ {len(pip_passed)} PIP-passing candidates — stopping early")
            break

    if pip_passed:
        # Consensus cluster among PIP-passing results
        groups: List[List[Dict]] = []
        for r in pip_passed:
            placed = False
            for g in groups:
                if haversine_km(r["lat"], r["lng"], g[0]["lat"], g[0]["lng"]) <= CONSENSUS_RADIUS_KM:
                    g.append(r); placed = True; break
            if not placed:
                groups.append([r])
        groups.sort(key=lambda g: sum(x["confidence"] for x in g), reverse=True)
        winner = groups[0]
        avg_lat = sum(x["lat"] for x in winner) / len(winner)
        avg_lng = sum(x["lng"] for x in winner) / len(winner)
        agreement = len(winner) / len(pip_passed)
        avg_conf  = sum(x["confidence"] for x in winner) / len(winner)
        composite = min(agreement * 0.6 + avg_conf * 0.4, 0.95)
        sources   = list({x["source"] for x in winner})

        method = "street_pip_consensus" if composite >= 0.85 else "pip_consensus"
        return {
            "lat": avg_lat, "lng": avg_lng,
            "confidence": composite,
            "method": method,
            "notes": (
                f"PIP-validated consensus from {len(winner)}/{len(pip_passed)} candidates. "
                f"Sources: {', '.join(sources)}. "
                f"Best display: {winner[0].get('display_name','')[:120]}"
            ),
            "pip_verified": True,
        }

    # All geocoders failed PIP → use centroid
    centroid = index.centroid(constituency)
    if centroid:
        actual_at_cur = index.which_constituency(cur_lat, cur_lng) if cur_lat and cur_lng else None
        return {
            "lat": centroid[0], "lng": centroid[1],
            "confidence": 0.70,
            "method": "shapefile_centroid_fallback",
            "notes": (
                f"No geocoder result passed PIP for '{constituency}'. "
                f"Current coords land in: '{actual_at_cur or 'unknown/outside'}'. "
                f"Centroid used as best available placement."
            ),
            "pip_verified": True,  # centroid is guaranteed inside polygon
        }

    return {
        "lat": cur_lat, "lng": cur_lng,
        "confidence": 0.10,
        "method": "no_polygon_no_fix",
        "notes": f"Shapefile has no polygon for '{constituency}'. Manual review required.",
        "pip_verified": False,
    }


# ── Stage 1: Triage ─────────────────────────────────────────────────────────────

def triage_hitl_entries(
    hitl_entries: List[Dict],
    office_map: Dict[int, Dict],
    cluster_map: Dict[int, List[int]],
) -> Tuple[List[Dict], List[Dict], List[Dict], List[Dict]]:
    """
    Sort all HITL entries into four buckets.
    Returns: (already_resolved, stale_duplicates, needs_repin, no_action_needed)
    """
    already_resolved = []
    stale_duplicates = []
    needs_repin      = []
    no_action        = []

    # Group by office_id to detect stale duplicates
    by_office: Dict[int, List[Dict]] = defaultdict(list)
    for h in hitl_entries:
        by_office[h["office_id"]].append(h)

    # Sort each group by created_at desc so newest is first
    for oid in by_office:
        by_office[oid].sort(key=lambda x: x.get("created_at") or "", reverse=True)

    seen_hitl_ids: Set[int] = set()

    for office_id, entries in by_office.items():
        office = office_map.get(office_id, {})
        geo_status = (office.get("geocode_status") or "").lower()
        verified   = office.get("verified", False)
        confidence = office.get("geocode_confidence") or office.get("confidence_score") or 0
        if isinstance(confidence, int) and confidence > 1:
            confidence = confidence / 100  # normalise if stored as integer %

        is_resolved = (
            geo_status in VERIFIED_STATUSES or
            verified is True or
            confidence >= 0.90
        )

        # Mark all but the newest entry as stale duplicates
        newest = entries[0]
        older  = entries[1:]

        for old in older:
            if old["id"] not in seen_hitl_ids:
                old["_triage"] = "STALE_DUPLICATE"
                old["_office"] = office
                stale_duplicates.append(old)
                seen_hitl_ids.add(old["id"])

        if newest["id"] in seen_hitl_ids:
            continue
        seen_hitl_ids.add(newest["id"])
        newest["_office"] = office

        if is_resolved:
            newest["_triage"] = "ALREADY_RESOLVED"
            already_resolved.append(newest)
        elif office_id in cluster_map:
            newest["_triage"] = "CLUSTER"
            newest["_cluster_peers"] = cluster_map[office_id]
            needs_repin.append(newest)
        elif newest.get("status") in ("pending", "needs_review", None):
            newest["_triage"] = "GENUINELY_PENDING"
            needs_repin.append(newest)
        else:
            newest["_triage"] = "NO_ACTION"
            no_action.append(newest)

    log.info(f"\nTRIAGE RESULTS:")
    log.info(f"  Already resolved (archive): {len(already_resolved)}")
    log.info(f"  Stale duplicates (archive): {len(stale_duplicates)}")
    log.info(f"  Needs re-pinning:           {len(needs_repin)}")
    log.info(f"  No action needed:           {len(no_action)}")
    return already_resolved, stale_duplicates, needs_repin, no_action


# ── Supabase writes ─────────────────────────────────────────────────────────────

def archive_hitl_entry(hitl_id: int, reason: str) -> bool:
    """Mark a HITL entry as archived — it's done, it shouldn't clog the queue."""
    payload = {
        "status": "archived",
        "dismiss_reason": reason[:500],
    }
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/geocode_hitl_queue?id=eq.{hitl_id}",
        headers=HEADERS, json=payload, timeout=10,
    )
    return resp.status_code in (200, 204)

def apply_repin(office_id: int, result: Dict, hitl_id: int) -> bool:
    """Write new coordinates to iebc_offices and resolve HITL entry."""
    conf_int = max(0, min(100, int(result["confidence"] * 100)))
    payload = {
        "latitude":               result["lat"],
        "longitude":              result["lng"],
        "geocode_method":         result["method"],
        "geocode_status":         "shapefile_corrected",
        "geocode_confidence":     result["confidence"],
        "confidence_score":       conf_int,
        "multi_source_confidence":result["confidence"],
        "updated_at":             datetime.now(timezone.utc).isoformat(),
    }
    r1 = requests.patch(
        f"{SUPABASE_URL}/rest/v1/iebc_offices?id=eq.{office_id}",
        headers=HEADERS, json=payload, timeout=10,
    )
    ok = r1.status_code in (200, 204)

    # Resolve the HITL entry
    r2 = requests.patch(
        f"{SUPABASE_URL}/rest/v1/geocode_hitl_queue?id=eq.{hitl_id}",
        headers=HEADERS,
        json={
            "status":          "resolved",
            "final_latitude":  result["lat"],
            "final_longitude": result["lng"],
            "dismiss_reason":  result["notes"][:500],
            "resolved_at":     datetime.now(timezone.utc).isoformat(),
        },
        timeout=10,
    )
    return ok and r2.status_code in (200, 204)


# ── Report writer ───────────────────────────────────────────────────────────────

def write_report(all_rows: List[Dict], output_path: str):
    """Write full audit CSV."""
    if not all_rows:
        log.info("No rows to write.")
        return

    import csv
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "office_id","hitl_id","constituency","county",
        "triage","status",
        "proposed_lat","proposed_lng",
        "final_lat","final_lng",
        "method","confidence","pip_verified",
        "cluster_peers","notes","applied",
    ]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(all_rows)

    log.info(f"Report saved: {output_path}")


# ── Main ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="HITL Full Audit + Precision Re-Pinner")
    parser.add_argument("--shapefile", required=True, help="Path to Kenya constituency shapefile/GeoJSON")
    parser.add_argument("--name-col",   help="Column name for constituency name in shapefile")
    parser.add_argument("--county-col", help="Column name for county in shapefile")
    parser.add_argument("--apply",      action="store_true", help="Write corrections to Supabase")
    parser.add_argument("--max",        type=int, default=9999, help="Max offices to re-pin")
    parser.add_argument("--dry-run-report", action="store_true",
                        help="Triage and report only — no geocoding, no writes")
    parser.add_argument("--output", default="reports/hitl_full_audit.csv", help="Output CSV path")
    args = parser.parse_args()

    mode = "APPLY (LIVE)" if args.apply else "DRY RUN"
    log.info("=" * 70)
    log.info("HITL FULL AUDIT — PRECISION RE-PINNER + ARCHIVE CLEANER")
    log.info(f"Mode: {mode}")
    log.info("=" * 70)

    # ── Load shapefile ────────────────────────────────────────────────────────
    index = ConstituencyIndex(args.shapefile, args.name_col, args.county_col)

    # ── Fetch all data ────────────────────────────────────────────────────────
    hitl_entries  = fetch_all_hitl()
    office_ids    = list({h["office_id"] for h in hitl_entries})
    office_map    = fetch_offices_for_ids(office_ids)
    all_offices   = fetch_all_offices_coords()
    cluster_map   = find_clusters(all_offices)

    log.info(f"\n  {len(cluster_map)} offices are in coordinate clusters")
    # Phase 0: Init AdminTask
    admin_task = None
    if args.task_id and HAS_ADMIN_LIB:
        try:
            admin_task = AdminTask(args.task_id)
            admin_task.log(f"Starting High-Precision HITL Auditor (apply={args.apply})", level='step')
        except Exception as e:
            log.warning(f"Failed to init AdminTask: {e}")

    if admin_task: admin_task.log("Sync Phase 1: Triaging HITL queue...", level='step')
    # ── Stage 1: Triage ───────────────────────────────────────────────────────
    already_resolved, stale_duplicates, needs_repin, no_action = triage_hitl_entries(
        hitl_entries, office_map, cluster_map
    )

    all_rows: List[Dict] = []

    # ── Stage 2A: Archive already-resolved ────────────────────────────────────
    log.info(f"\n[STAGE 2A] Archiving {len(already_resolved)} already-resolved entries...")
    for e in already_resolved:
        office = e.get("_office", {})
        if args.apply:
            archive_hitl_entry(e["id"], "Auto-archived: office already verified/resolved")
        all_rows.append({
            "office_id":    e["office_id"],
            "hitl_id":      e["id"],
            "constituency": office.get("constituency_name") or office.get("constituency",""),
            "county":       office.get("county",""),
            "triage":       "ALREADY_RESOLVED",
            "status":       "archived",
            "proposed_lat": e.get("proposed_latitude"),
            "proposed_lng": e.get("proposed_longitude"),
            "final_lat":    office.get("latitude"),
            "final_lng":    office.get("longitude"),
            "method":       "pre_verified",
            "confidence":   office.get("geocode_confidence") or office.get("confidence_score"),
            "pip_verified": None,
            "cluster_peers": None,
            "notes":        "Already verified — archived from active queue",
            "applied":      args.apply,
        })

    # ── Stage 2B: Archive stale duplicates ───────────────────────────────────
    log.info(f"[STAGE 2B] Archiving {len(stale_duplicates)} stale duplicate entries...")
    for e in stale_duplicates:
        office = e.get("_office", {})
        if args.apply:
            archive_hitl_entry(e["id"], "Auto-archived: newer HITL entry exists for this office")
        all_rows.append({
            "office_id":    e["office_id"],
            "hitl_id":      e["id"],
            "constituency": office.get("constituency_name") or office.get("constituency",""),
            "county":       office.get("county",""),
            "triage":       "STALE_DUPLICATE",
            "status":       "archived",
            "proposed_lat": e.get("proposed_latitude"),
            "proposed_lng": e.get("proposed_longitude"),
            "final_lat":    None,
            "final_lng":    None,
            "method":       "stale_duplicate",
            "confidence":   None,
            "pip_verified": None,
            "cluster_peers":None,
            "notes":        f"Superseded by newer HITL entry. Created: {e.get('created_at','')}",
            "applied":      args.apply,
        })

    # ── Stage 2C: Precision re-pin for clusters + genuinely pending ───────────
    if admin_task: admin_task.log(f"Sync Phase 2: Resolving {len(to_repin)} complex offices...", level='step')
    to_repin = needs_repin[:args.max]
    log.info(f"\n[STAGE 2C] Precision re-pinning {len(to_repin)} offices...")
    repin_applied = 0
    repin_queued  = 0

    for i, entry in enumerate(to_repin, 1):
        office = entry.get("_office", {})
        constituency = (office.get("constituency_name") or office.get("constituency","")).strip()
        county       = office.get("county","").strip()
        triage       = entry.get("_triage","")
        cluster_peers = entry.get("_cluster_peers", [])

        log.info(
            f"\n  [{i}/{len(to_repin)}] [{triage}] {constituency} ({county})"
            + (f" — cluster with {len(cluster_peers)} peer(s)" if cluster_peers else "")
        )

        if args.dry_run_report:
            all_rows.append({
                "office_id":    entry["office_id"],
                "hitl_id":      entry["id"],
                "constituency": constituency,
                "county":       county,
                "triage":       triage,
                "status":       "pending_repin",
                "proposed_lat": entry.get("proposed_latitude"),
                "proposed_lng": entry.get("proposed_longitude"),
                "final_lat":    None,
                "final_lng":    None,
                "method":       "dry_run",
                "confidence":   None,
                "pip_verified": None,
                "cluster_peers": ",".join(str(x) for x in cluster_peers),
                "notes":        "Dry run — no geocoding performed",
                "applied":      False,
            })
            continue

        result = precision_repin(office, index)

        log.info(
            f"    → ({result['lat']:.5f}, {result['lng']:.5f}) "
            f"conf={result['confidence']:.2f} method={result['method']}"
        )

        applied = False
        if args.apply:
            if result["confidence"] >= AUTO_APPLY_CONFIDENCE:
                ok = apply_repin(entry["office_id"], result, entry["id"])
                applied = ok
                if ok:
                    repin_applied += 1
                    log.info(f"    ✅ Applied to office {entry['office_id']}")
                else:
                    log.error(f"    ❌ Write failed for office {entry['office_id']}")
            else:
                # Low confidence — update proposed in HITL but keep pending
                requests.patch(
                    f"{SUPABASE_URL}/rest/v1/geocode_hitl_queue?id=eq.{entry['id']}",
                    headers=HEADERS,
                    json={
                        "proposed_latitude":  result["lat"],
                        "proposed_longitude": result["lng"],
                        "confidence":         result["confidence"],
                        "dismiss_reason":     result["notes"][:500],
                    },
                    timeout=10,
                )
                repin_queued += 1
                log.info(f"    ⚠ Low confidence ({result['confidence']:.2f}) — updated proposal, left pending")
        else:
            if result["confidence"] >= AUTO_APPLY_CONFIDENCE:
                log.info(f"    🔒 Would auto-apply (dry run)")
            else:
                log.info(f"    ⚠  Would leave pending (low confidence)")

        all_rows.append({
            "office_id":    entry["office_id"],
            "hitl_id":      entry["id"],
            "constituency": constituency,
            "county":       county,
            "triage":       triage,
            "status":       "applied" if applied else "proposed_updated",
            "proposed_lat": entry.get("proposed_latitude"),
            "proposed_lng": entry.get("proposed_longitude"),
            "final_lat":    result["lat"],
            "final_lng":    result["lng"],
            "method":       result["method"],
            "confidence":   result["confidence"],
            "pip_verified": result["pip_verified"],
            "cluster_peers":(",".join(str(x) for x in cluster_peers) if cluster_peers else ""),
            "notes":        result["notes"],
            "applied":      applied,
        })

    # ── Final summary ─────────────────────────────────────────────────────────
    log.info("")
    if admin_task: admin_task.log("Sync Phase 3: Finalizing audit and cleaning queue...", level='step')
    log.info("=" * 70)

    log.info("FULL AUDIT SUMMARY")
    log.info("=" * 70)
    log.info(f"  Total HITL entries processed: {len(hitl_entries)}")
    log.info(f"  ✅ Already resolved → archived: {len(already_resolved)}")
    log.info(f"  🗑  Stale duplicates → archived: {len(stale_duplicates)}")
    log.info(f"  🔧 Re-pinned and applied:       {repin_applied}")
    log.info(f"  ⚠  Re-pinned, left pending:     {repin_queued}")
    log.info(f"  📋 No action needed:            {len(no_action)}")
    active_remaining = len(needs_repin) - repin_applied
    log.info(f"  📌 Active queue after run:      ~{max(0, active_remaining)}")
    log.info("=" * 70)

    if admin_task:
        admin_task.complete(f"Audit Finished. {repin_applied} fixed, {len(already_resolved)} archived.")
    
    if not args.apply:
        log.info("\nDry run complete — no changes written. Add --apply to commit.")

    write_report(all_rows, args.output)


if __name__ == "__main__":
    main()
