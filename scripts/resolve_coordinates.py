#!/usr/bin/env python3
"""
Multi-Source Cross-Validated Geocoding Resolver for Nasaka IEBC

Queries Nominatim, Geocode.xyz, Geokeo, and Gemini AI to find the most
accurate coordinate for each IEBC office.  Uses weighted-cluster voting,
DB cross-validation (constituency→county), reverse geocoding checks,
direction metadata extraction, contribution data integration, and
duplicate/cluster detection.

Usage:
  python scripts/resolve_coordinates.py                    # Dry-run all flagged offices
  python scripts/resolve_coordinates.py --all              # Resolve ALL offices
  python scripts/resolve_coordinates.py --office-id 151    # Resolve one office
  python scripts/resolve_coordinates.py --apply            # Write results to Supabase
  python scripts/resolve_coordinates.py --max-resolve 20   # Limit batch size
"""

import os
import re
import sys
import json
import time
import random
import math
import logging
import argparse
import requests
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ── Configuration ─────────────────────────────────────────────────────────────

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ftswzvqwxdwgkvfbwfpx.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_ANON_KEY", ""))
GEMINI_API_KEY = os.getenv("VITE_GEMINI_API_KEY", "")
GEOKEO_API_KEY = os.getenv("VITE_GEOKEO_API_KEY", "")
OPENAI_API_KEY = os.getenv("VITE_OPEN_AI_KEY", "")

# ArcGIS Keys (with rotation support)
ARCGIS_API_KEY_1 = os.getenv("ARCGIS_API_KEY_PRIMARY", "")
ARCGIS_API_KEY_2 = os.getenv("ARCGIS_API_KEY_SECONDARY", "")

DOMAIN = os.getenv("DOMAIN", "nasakaiebc.civiceducationkenya.com")
USER_AGENT = os.getenv("USER_AGENT", f"CEKA-Nasaka/1.0 ({DOMAIN})")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

KENYA_BOUNDS = {"lat_min": -5.0, "lat_max": 5.0, "lng_min": 33.9, "lng_max": 42.0}
CONSENSUS_RADIUS_KM = 1.0
AUTO_APPLY_THRESHOLD = 0.7
DISPLACEMENT_THRESHOLD_KM = 5.0
CLUSTER_DETECTION_KM = 0.5
NOMINATIM_RATE_LIMIT = 2.0  # Conservative 2s delay to avoid IP blocks

# v9.3: RateLimiter class to enforce mandatory sleeps between API calls
class RateLimiter:
    def __init__(self, min_interval_seconds):
        self.min_interval = min_interval_seconds
        self.last_call = 0
    
    def wait(self):
        elapsed = time.time() - self.last_call
        wait_time = self.min_interval - elapsed
        if wait_time > 0:
            time.sleep(wait_time)
        self.last_call = time.time()

RATE_LIMITERS = {
    "nominatim": RateLimiter(1.1),
    "gemini":    RateLimiter(4.0),
    "openai":    RateLimiter(6.0),
    "arcgis":    RateLimiter(0.5),
    "geokeo":    RateLimiter(1.0),
    "geocode_xyz": RateLimiter(1.1),
    "photon":      RateLimiter(1.1),
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("resolve")

# ── Per-County Adaptive Thresholds ────────────────────────────────────────────

ADAPTIVE_THRESHOLDS_KM = {
    "turkana": 150, "marsabit": 200, "wajir": 150, "mandera": 200,
    "garissa": 150, "tana river": 120, "kitui": 100, "kajiado": 100,
    "narok": 100, "samburu": 100, "laikipia": 80, "baringo": 80,
    "west pokot": 80, "isiolo": 100, "makueni": 80, "machakos": 80,
    "kilifi": 80, "taita taveta": 80, "meru": 80, "nakuru": 80,
    "elgeyo-marakwet": 60,
}
DEFAULT_THRESHOLD_KM = 50

# ── Cardinal direction variants for cluster detection ─────────────────────────

CARDINAL_SUFFIXES = {"north", "south", "east", "west", "central"}

# v9.1: Sub-county to County mapping for Nominatim admin level mismatches
SUBCOUNTY_TO_COUNTY = {
    "CHANGAMWE": "MOMBASA",
    "JOMVU": "MOMBASA",
    "LIKONI": "MOMBASA",
    "GUCHA": "KISII",
    "MASABA SOUTH": "KISII",
    "MT ELGON": "BUNGOMA",
    "KIMILILI": "BUNGOMA",
    "KISAUNI": "MOMBASA",
    "NYALI": "MOMBASA",
    "MVITA": "MOMBASA",
}

# ── Direction-type keywords ───────────────────────────────────────────────────

DIRECTION_KEYWORDS = {
    "beside": "beside", "next to": "next to", "opposite": "opposite",
    "behind": "behind", "along": "along", "near": "near",
    "adjacent": "adjacent", "within": "within", "across": "across",
    "at": "at", "in front of": "in front of", "off": "off",
    "on": "on", "inside": "inside", "opp": "opposite",
    "opp.": "opposite",
    # v9.1 Giga-Ham additions
    "past": "past", "towards": "towards", "alongside": "alongside",
    "beyond": "beyond", "before": "before", "after": "after",
    "around": "around", "by": "by", "nextto": "next to",
    "adjacent to": "adjacent", "close to": "near",
    "proximal to": "near", "opposite to": "opposite",
}

# ── Landmark-type patterns ────────────────────────────────────────────────────

LANDMARK_TYPE_PATTERNS = {
    r"\boffice\b": "office",
    r"\bbuilding\b": "building",
    r"\bhouse\b": "building",
    r"\bschool\b": "school",
    r"\bacademy\b": "school",
    r"\bhospital\b": "hospital",
    r"\bdispensary\b": "hospital",
    r"\bhealth\s*cent(?:re|er)\b": "hospital",
    r"\bchurch\b": "religious",
    r"\bmosque\b": "religious",
    r"\btemple\b": "religious",
    r"\bmarket\b": "market",
    r"\bstadium\b": "sports",
    r"\bground\b": "sports",
    r"\bpark\b": "park",
    r"\bstation\b": "station",
    r"\bstage\b": "station",
    r"\bhotel\b": "hotel",
    r"\bsupermarket\b": "market",
    r"\bbank\b": "bank",
    r"\bpetrol\b": "fuel_station",
    r"\btotal\s+station\b": "fuel_station",
    r"\barea\b": "area",
    r"\btown\b": "town",
    r"\bcentre\b": "area",
    r"\bcenter\b": "area",
    r"\bcomplex\b": "building",
    r"\bplaza\b": "building",
    r"\bmall\b": "building",
    r"\bcourt\b": "government",
    r"\bDCC\b": "government",
    r"\bDO\b": "government",
    r"\bchief\b": "government",
    r"\bpolice\b": "government",
    r"\bpost\s*office\b": "government",
    r"\bjunction\b": "junction",
    r"\broundabout\b": "junction",
    r"\bbridge\b": "infrastructure",
    r"\briver\b": "natural",
    r"\bhall\b": "building",
}


# ── Haversine ─────────────────────────────────────────────────────────────────

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def is_in_kenya(lat: float, lng: float) -> bool:
    return (KENYA_BOUNDS["lat_min"] <= lat <= KENYA_BOUNDS["lat_max"] and
            KENYA_BOUNDS["lng_min"] <= lng <= KENYA_BOUNDS["lng_max"])


# ── DB Reference Data ─────────────────────────────────────────────────────────

_constituency_county_map: Dict[str, str] = {}
_county_names: Dict[int, str] = {}
_constituency_wards: Dict[str, List[str]] = {}  # v9.1: Ward-level precision
_rev_geo_cache: Dict[Tuple[float, float], Dict[str, str]] = {}  # v9.1: Coordinate cache
_pdf_extraction_data: List[Dict] = []  # v9.1: PDF fallback data
_CIRCUIT_BREAKERS: Dict[str, Dict] = {}  # v9.3: Stores {"tripped": bool, "last_trip": float}
CACHE_FILE = Path("data/cache/rev_geo_cache.json")


# ── Reliable Requests with Exponential Backoff & Circuit Breaker (v9.1) ───────

def safe_request(url: str, params: Optional[Dict] = None, method: str = "GET",
                 json_data: Optional[Dict] = None, headers: Optional[Dict] = None,
                 max_retries: int = 3, initial_delay: float = 2.0) -> Optional[requests.Response]:
    """Execute a request with exponential backoff and circuit breaker support."""
    from urllib.parse import urlparse
    host = urlparse(url).netloc

    # Circuit breaker (v9.3): skip hosts that have been tripped within the last 5 minutes
    breaker = _CIRCUIT_BREAKERS.get(host)
    if breaker and breaker.get("tripped"):
        elapsed = time.time() - breaker.get("last_trip", 0)
        if elapsed < 300:  # 5-minute cool-off
            return None
        else:
            log.info(f"  🔄 Circuit breaker reset for {host} (cool-off expired)")
            _CIRCUIT_BREAKERS[host] = {"tripped": False, "last_trip": 0}

    delay = initial_delay
    for attempt in range(max_retries + 1):
        try:
            if method.upper() == "GET":
                resp = requests.get(url, params=params, headers=headers, timeout=20)
            else:
                resp = requests.post(url, json=json_data, headers=headers, timeout=20)

            if resp.status_code == 200:
                return resp

            if resp.status_code == 403:
                log.error(f"  ⛔ CIRCUIT BREAKER TRIPPED for {host} (403 Forbidden)")
                _CIRCUIT_BREAKERS[host] = {"tripped": True, "last_trip": time.time()}
                return None

            if resp.status_code == 429 or 500 <= resp.status_code < 600:
                if attempt < max_retries:
                    sleep_time = delay + random.uniform(0.1, 1.5)
                    log.warning(f"  Rate limited ({resp.status_code}). Retrying in {sleep_time:.1f}s (Attempt {attempt+1}/{max_retries})...")
                    time.sleep(sleep_time)
                    delay *= 2
                    continue
                else:
                    log.error(f"  ⚠ CIRCUIT BREAKER TRIPPED for {host} after {max_retries} retries")
                    _CIRCUIT_BREAKERS[host] = {"tripped": True, "last_trip": time.time()}
                    return None

            resp.raise_for_status()
            return resp
        except requests.exceptions.RequestException as e:
            if attempt < max_retries:
                sleep_time = delay + random.uniform(0.1, 1.5)
                log.warning(f"  Request error: {e}. Retrying in {sleep_time:.1f}s...")
                time.sleep(sleep_time)
                delay *= 2
            else:
                log.error(f"  Request failed after {max_retries} attempts for {host}: {e}")
                _CIRCUIT_BREAKERS[host] = {"tripped": True, "last_trip": time.time()}
                return None
    return None


def load_reference_data():
    """Load constituencies→county mapping and county names from Supabase."""
    global _constituency_county_map, _county_names, _rev_geo_cache

    # v9.3: Load persistent reverse geocode cache
    load_rev_geo_cache()

    log.info("Loading reference data from Supabase...")

    # Load counties
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/counties?select=id,name&order=id",
        headers=HEADERS, timeout=15,
    )
    resp.raise_for_status()
    counties = resp.json()
    _county_names = {c["id"]: c["name"] for c in counties}
    log.info(f"  Loaded {len(_county_names)} counties")

    # Load constituencies with county_id
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/constituencies?select=id,name,county_id&order=id",
        headers=HEADERS, timeout=15,
    )
    resp.raise_for_status()
    constituencies = resp.json()
    for c in constituencies:
        county_name = _county_names.get(c["county_id"], "")
        _constituency_county_map[c["name"].strip().upper()] = county_name.strip().upper()
    log.info(f"  Loaded {len(_constituency_county_map)} constituency→county mappings")

    # v9.1: Load wards for Ward-level precision
    load_ward_data()

    # v9.1: Load PDF extraction data for Stage 7 fallback
    load_pdf_extraction_data()


def load_ward_data():
    """v9.1: Load ward data from Supabase for Ward-level precision validation."""
    global _constituency_wards
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/wards?select=ward_name,constituency",
            headers=HEADERS, timeout=15,
        )
        resp.raise_for_status()
        wards = resp.json()
        for w in wards:
            wname = w["ward_name"].strip().upper()
            cname = w["constituency"].strip().upper()
            _constituency_wards.setdefault(cname, []).append(wname)
        log.info(f"  Loaded {len(wards)} wards for precision validation")
    except Exception as e:
        log.warning(f"  Ward data load failed (non-fatal): {e}")


def load_pdf_extraction_data():
    """v9.1: Load high-fidelity PDF extraction data for Stage 7 fallback."""
    csv_path = Path("data/processed/raw_iebc_offices.csv")
    if not csv_path.exists():
        log.info("  No PDF extraction CSV found (Stage 7 fallback disabled)")
        return
    try:
        import csv
        with open(csv_path, "r", encoding="utf-8") as f:
            global _pdf_extraction_data
            _pdf_extraction_data = list(csv.DictReader(f))
        log.info(f"  Loaded {len(_pdf_extraction_data)} records from PDF extraction CSV")
    except Exception as e:
        log.error(f"  Failed to load PDF CSV: {e}")


# v9.3: Persistent Cache Operations
def load_rev_geo_cache():
    """Load reverse geocode cache from local JSON file."""
    global _rev_geo_cache
    if not CACHE_FILE.exists():
        return
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(CACHE_FILE, "r") as f:
            data = json.load(f)
            # Reconstruct tuple keys from string keys
            _rev_geo_cache = {eval(k): v for k, v in data.items()}
        log.info(f"  Loaded {len(_rev_geo_cache)} entries from persistent cache")
    except Exception as e:
        log.warning(f"  Failed to load cache file: {e}")

def save_rev_geo_cache():
    """Save current reverse geocode cache to local JSON file."""
    if not _rev_geo_cache:
        return
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(CACHE_FILE, "w") as f:
            # Convert tuple keys to string keys for JSON serialization
            data = {str(k): v for k, v in _rev_geo_cache.items()}
            json.dump(data, f, indent=2)
    except Exception as e:
        log.warning(f"  Failed to save cache file: {e}")


def normalize_county(name: str) -> str:
    """Normalize county name for comparison (uppercase, strip, handle Murang'a etc)."""
    n = name.strip().upper()
    n = n.replace("'", "'").replace("'", "'").replace("`", "'")
    n = n.replace("/", "-").replace("\u2013", "-")  # v9.1: slash/hyphen equivalence
    n = re.sub(r"\s+", " ", n)
    # v9.1: Resolve sub-counties/constituencies to parent counties
    return SUBCOUNTY_TO_COUNTY.get(n, n)


def expected_county_for_constituency(constituency: str) -> Optional[str]:
    """Look up the expected county from the DB mapping."""
    key = constituency.strip().upper()
    return _constituency_county_map.get(key)


# ── Direction Metadata Extraction ─────────────────────────────────────────────

def extract_direction_metadata(office_location: str, landmark: str) -> Dict[str, Any]:
    """Parse office_location and landmark fields to extract direction metadata."""
    result: Dict[str, Any] = {
        "direction_type": None,
        "direction_landmark": None,
        "direction_distance": None,
        "distance_from_landmark": None,
        "landmark_type": None,
        "landmark_subtype": None,
    }

    combined = f"{office_location or ''} {landmark or ''}".strip()
    if not combined:
        return result

    # Extract direction type
    combined_lower = combined.lower()
    for keyword, dtype in DIRECTION_KEYWORDS.items():
        if keyword in combined_lower:
            result["direction_type"] = dtype
            break

    # Extract distance (e.g. "500m from", "2km from", "0.5 km")
    dist_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:m(?:eters?|etres?)?|km)\b', combined, re.IGNORECASE)
    if dist_match:
        dist_val = float(dist_match.group(1))
        unit_match = re.search(r'\d\s*(km|m)', combined, re.IGNORECASE)
        if unit_match and unit_match.group(1).lower() == "km":
            dist_val = dist_val * 1000  # Convert km to meters
        result["direction_distance"] = dist_val
        result["distance_from_landmark"] = dist_val

    # Extract landmark name — text after "from", "to", "of", direction keywords
    landmark_text = landmark or ""
    if landmark_text:
        # Remove distance prefix like "500m from"
        cleaned = re.sub(r'^\d+(?:\.\d+)?\s*(?:m|km|meters?|metres?)\s*(?:from|to|of)?\s*', '', landmark_text, flags=re.IGNORECASE)
        cleaned = re.sub(r'^(?:near|beside|next\s+to|opposite|behind|opp\.?)\s*', '', cleaned, flags=re.IGNORECASE)
        if cleaned.strip():
            result["direction_landmark"] = cleaned.strip()

    # Classify landmark type
    text_to_check = result["direction_landmark"] or combined
    for pattern, ltype in LANDMARK_TYPE_PATTERNS.items():
        if re.search(pattern, text_to_check, re.IGNORECASE):
            result["landmark_type"] = ltype
            break

    return result


# ── Contribution Data Lookup ──────────────────────────────────────────────────

def fetch_contributions_for_office(office_id: int) -> List[Dict]:
    """Fetch approved/pending contributions for a given office."""
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/iebc_office_contributions"
            f"?original_office_id=eq.{office_id}"
            f"&status=in.(approved,pending)"
            f"&select=id,submitted_latitude,submitted_longitude,submitted_constituency,submitted_county,"
            f"submitted_office_location,submitted_landmark,confidence_score,confirmation_count",
            headers=HEADERS, timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        log.warning(f"  Failed to fetch contributions: {e}")
    return []


# ── Reverse Geocoding for County Validation ───────────────────────────────────

def reverse_geocode_county(lat: float, lng: float) -> Optional[str]:
    """Reverse-geocode a coordinate via Nominatim to extract the county name."""
    try:
        RATE_LIMITERS["nominatim"].wait()
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lng, "format": "json", "addressdetails": 1, "zoom": 6},
            headers={"User-Agent": "NasakaIEBC/1.0 (civiceducationkenya.com)"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        address = data.get("address", {})
        # Nominatim returns Kenya counties under 'county', 'state', or 'state_district'
        county = address.get("county") or address.get("state_district") or address.get("state") or ""
        # Strip " County" suffix if present
        county = re.sub(r"\s*County\s*$", "", county, flags=re.IGNORECASE).strip()
        return county if county else None
    except Exception as e:
        log.warning(f"  Reverse geocode failed: {e}")
        return None


def validate_coords_against_county(lat: float, lng: float, expected_county: str) -> bool:
    """Check if the reverse-geocoded county matches the expected county."""
    if not expected_county:
        return True  # Can't validate, allow through
    rev_county = reverse_geocode_county(lat, lng)
    if not rev_county:
        return False  # Can't reverse geocode, reject
    return normalize_county(rev_county) == normalize_county(expected_county) or \
           normalize_county(expected_county) in normalize_county(rev_county) or \
           normalize_county(rev_county) in normalize_county(expected_county)


def reverse_geocode_address(lat: float, lng: float) -> Dict[str, str]:
    """v9.1: Reverse-geocode via Nominatim with caching — returns county + ward."""
    cache_key = (round(lat, 5), round(lng, 5))
    if cache_key in _rev_geo_cache:
        return _rev_geo_cache[cache_key]

    RATE_LIMITERS["nominatim"].wait()
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lng, "format": "json", "addressdetails": 1, "zoom": 6},
            headers={"User-Agent": USER_AGENT},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        address = data.get("address", {})
        county = address.get("county") or address.get("state_district") or address.get("state") or ""
        county = normalize_county(county)
        ward = address.get("suburb") or address.get("neighbourhood") or address.get("town") or address.get("village") or ""

        res = {"county": county, "ward": ward}
        _rev_geo_cache[cache_key] = res
        return res
    except Exception as e:
        log.warning(f"  Reverse geocode address failed: {e}")
        return {"county": "", "ward": ""}


def validate_coords_precision(lat: float, lng: float, expected_county: str,
                              expected_constituency: str,
                              provided_address: Optional[Dict] = None) -> Tuple[bool, str]:
    """v9.1: Strict County check + Ward match boost for precision validation."""
    if not expected_county:
        return True, ""

    if provided_address:
        rev_county_raw = provided_address.get("county") or provided_address.get("state_district") or ""
        rev_county = normalize_county(rev_county_raw)
        rev_ward = (provided_address.get("suburb") or
                    provided_address.get("neighbourhood") or
                    provided_address.get("town") or "")
    else:
        rev = reverse_geocode_address(lat, lng)
        rev_county, rev_ward = rev["county"], rev["ward"]

    if not rev_county:
        return False, "could_not_determine_county"

    exp_county = normalize_county(expected_county)
    if rev_county != exp_county and exp_county not in rev_county and rev_county not in exp_county:
        return False, f"county_mismatch: got {rev_county}, expected {exp_county}"

    if rev_ward and expected_constituency:
        valid_wards = _constituency_wards.get(expected_constituency.upper(), [])
        nw = rev_ward.upper()
        if any(nw in w or w in nw for w in valid_wards):
            return True, "ward_match"

    return True, "county_match"


# ── Individual Geocoders ──────────────────────────────────────────────────────

def geocode_nominatim(query: str, limit: int = 5) -> List[Dict]:
    """OSM Nominatim — free, 1 req/s, countrycodes=ke. Returns multiple results."""
    try:
        RATE_LIMITERS["nominatim"].wait()
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "countrycodes": "ke", "format": "json", "limit": limit, "addressdetails": 1},
            headers={"User-Agent": "NasakaIEBC/1.0 (civiceducationkenya.com)"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        results = []
        for r in data:
            lat, lng = float(r["lat"]), float(r["lon"])
            if not is_in_kenya(lat, lng):
                continue
            address = r.get("address", {})
            county_raw = address.get("county") or address.get("state_district") or address.get("state") or ""
            county_clean = re.sub(r"\s*County\s*$", "", county_raw, flags=re.IGNORECASE).strip()
            results.append({
                "lat": lat, "lng": lng, "source": "nominatim",
                "confidence": min(float(r.get("importance", 0.5)) * 1.5, 1.0),
                "display_name": r.get("display_name", ""),
                "county_from_api": county_clean,
                "address_data": address,
            })
        return results
    except Exception as e:
        log.warning(f"  Nominatim failed: {e}")
        return []


def geocode_geocodexyz(query: str) -> List[Dict]:
    """Geocode.xyz — free, 1 req/s, region=KE."""
    try:
        RATE_LIMITERS["geocode_xyz"].wait()
        resp = safe_request(
            f"https://geocode.xyz/{requests.utils.quote(query)}",
            params={"json": "1", "region": "KE"},
        )
        if not resp:
            return []
        data = resp.json()
        if not data or "error" in data or not data.get("latt") or not data.get("longt"):
            return []
        lat, lng = float(data["latt"]), float(data["longt"])
        if not is_in_kenya(lat, lng):
            return []
        conf = min(float(data.get("confidence", "45")) / 100, 1.0) if data.get("confidence") else 0.45
        return [{"lat": lat, "lng": lng, "source": "geocode_xyz", "confidence": conf,
                 "display_name": data.get("standard", {}).get("addresst", query),
                 "county_from_api": ""}]
    except Exception as e:
        log.warning(f"  Geocode.xyz failed: {e}")
        return []


def geocode_geokeo(query: str) -> List[Dict]:
    """Geokeo — 2500/day, api key in env. Returns multiple results."""
    if not GEOKEO_API_KEY:
        return []
    try:
        RATE_LIMITERS["geokeo"].wait()
        resp = requests.get(
            "https://geokeo.com/geocode/v1/search.php",
            params={"q": query, "api": GEOKEO_API_KEY},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data or data.get("status") != "200" or not data.get("results"):
            return []
        results = []
        for r in data["results"]:
            lat = float(r["geometry"]["location"]["lat"])
            lng = float(r["geometry"]["location"]["lng"])
            if not is_in_kenya(lat, lng):
                continue
            results.append({
                "lat": lat, "lng": lng, "source": "geokeo", "confidence": 0.6,
                "display_name": r.get("formatted_address", query),
                "county_from_api": "",
            })
        return results
    except Exception as e:
        log.warning(f"  Geokeo failed: {e}")
        return []


# v9.1: ArcGIS Geocoder with key rotation
def geocode_arcgis(query: str, key_idx: int = 1) -> List[Dict]:
    """ArcGIS World Geocoding — enterprise-grade, key rotation support."""
    key = ARCGIS_API_KEY_1 if key_idx == 1 else ARCGIS_API_KEY_2
    if not key:
        return []
    try:
        RATE_LIMITERS["arcgis"].wait()
        resp = safe_request(
            "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates",
            params={"address": query, "f": "pjson", "token": key, "maxLocations": 3,
                    "countryCode": "KEN", "outFields": "Region,City,Neighborhood"},
        )
        if not resp:
            if key_idx == 1 and ARCGIS_API_KEY_2:
                return geocode_arcgis(query, 2)
            return []
        results = []
        for c in resp.json().get("candidates", []):
            lat, lng = c["location"]["y"], c["location"]["x"]
            if not is_in_kenya(lat, lng):
                continue
            region = c.get("attributes", {}).get("Region", "")
            county_clean = re.sub(r"\s*County\s*$", "", region, flags=re.IGNORECASE).strip()
            results.append({
                "lat": lat, "lng": lng, "source": f"arcgis_{key_idx}",
                "confidence": c.get("score", 50) / 100,
                "display_name": c.get("address", ""),
                "county_from_api": county_clean,
                "query_used": query,
            })
        return results
    except Exception as e:
        log.warning(f"  ArcGIS failed: {e}")
        return []


# v9.1: Photon (Komoot) Geocoder
def geocode_photon(query: str) -> List[Dict]:
    """Photon (Komoot) — OpenStreetMap-backed, no rate limit, bbox=Kenya."""
    try:
        RATE_LIMITERS["photon"].wait()
        resp = safe_request(
            "https://photon.komoot.io/api/",
            params={"q": query, "limit": 3, "bbox": "33.5,-4.7,42.0,5.5"},
        )
        if not resp:
            return []
        results = []
        for f in resp.json().get("features", []):
            lat = f["geometry"]["coordinates"][1]
            lng = f["geometry"]["coordinates"][0]
            if not is_in_kenya(lat, lng):
                continue
            state = f["properties"].get("state", "")
            county_clean = re.sub(r"\s*County\s*$", "", state, flags=re.IGNORECASE).strip()
            results.append({
                "lat": lat, "lng": lng, "source": "photon",
                "confidence": 0.55,
                "display_name": f["properties"].get("name", query),
                "county_from_api": county_clean,
                "query_used": query,
            })
        return results
    except Exception as e:
        log.warning(f"  Photon failed: {e}")
        return []


def geocode_gemini(constituency: str, county: str, office_location: str = "", landmark: str = "") -> List[Dict]:
    """Gemini AI — 60 RPM, lowest confidence (0.4) to mitigate hallucination."""
    if not GEMINI_API_KEY:
        return []
    try:
        RATE_LIMITERS["gemini"].wait()
        context_parts = [f"the {constituency} IEBC constituency office in {county} County, Kenya"]
        if office_location:
            context_parts.append(f"located at or near {office_location}")
        if landmark:
            context_parts.append(f"landmark reference: {landmark}")

        prompt = (
            f"What are the GPS coordinates of {', '.join(context_parts)}?\n\n"
            f"Return ONLY a valid JSON object: {{\"lat\": <number>, \"lng\": <number>, \"county\": \"<county name>\"}}\n"
            f"If uncertain, return: {{\"lat\": null, \"lng\": null, \"county\": null}}"
        )
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.0, "maxOutputTokens": 150},
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        if not text:
            return []
        m = re.search(r'\{[^}]+\}', text)
        if not m:
            return []
        parsed = json.loads(m.group(0))
        if parsed.get("lat") is None or parsed.get("lng") is None:
            return []
        lat, lng = float(parsed["lat"]), float(parsed["lng"])
        if not is_in_kenya(lat, lng):
            return []
        return [{
            "lat": lat, "lng": lng, "source": "gemini_ai", "confidence": 0.4,
            "display_name": f"{constituency} (Gemini)",
            "county_from_api": parsed.get("county", "") or "",
        }]
    except Exception as e:
        log.warning(f"  Gemini failed: {e}")
        return []


# v9.1: OpenAI Geocoder for high-precision validation
def geocode_openai(query: str) -> List[Dict]:
    """OpenAI GPT-4o-mini as a high-precision geocoding fallback."""
    if not OPENAI_API_KEY:
        return []
    try:
        RATE_LIMITERS["openai"].wait()
        prompt = (
            f"What are the GPS coordinates of the IEBC office for: '{query}' in Kenya?\n"
            f"Return ONLY a JSON object: {{\"lat\": <number>, \"lng\": <number>, \"county\": \"<county name>\"}}\n"
            f"If uncertain, return: {{\"lat\": null, \"lng\": null, \"county\": null}}"
        )
        resp = safe_request(
            "https://api.openai.com/v1/chat/completions",
            method="POST",
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            json_data={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.0,
                "response_format": {"type": "json_object"}
            }
        )
        if not resp:
            return []
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        if parsed.get("lat") is None or parsed.get("lng") is None:
            return []
        lat, lng = float(parsed["lat"]), float(parsed["lng"])
        if not is_in_kenya(lat, lng):
            return []
        return [{
            "lat": lat, "lng": lng, "source": "openai_gpt4", "confidence": 0.7,
            "display_name": f"{query} (OpenAI)",
            "county_from_api": parsed.get("county", "") or "",
            "query_used": query,
        }]
    except Exception as e:
        log.warning(f"  OpenAI geocode failed: {e}")
        return []


# ── Multi-Query Strategy ──────────────────────────────────────────────────────

def build_queries(office: Dict) -> List[str]:
    """Build 5 progressively specific geocoding queries."""
    constituency = office.get("constituency_name") or office.get("constituency", "")
    county = office.get("county", "")
    location = office.get("office_location", "")
    landmark = office.get("landmark", "")

    queries = []
    # Query 1: Generic constituency + county
    queries.append(f"{constituency} IEBC office {county} county Kenya")
    # Query 2: Office location + constituency + county
    if location:
        queries.append(f"{location}, {constituency}, {county} County, Kenya")
    # Query 3: Office location + landmark + county
    if location and landmark:
        queries.append(f"{location} near {landmark}, {county} County, Kenya")
    # Query 4: Landmark + constituency + county
    if landmark:
        queries.append(f"{landmark}, {constituency}, {county} County, Kenya")
    # Query 5: Town/area only (from office_location) + county
    if location:
        # Extract first meaningful town/area name
        town = re.sub(r'\b(Town|Centre|Center|CBD)\b', '', location, flags=re.IGNORECASE).strip()
        if town and town.upper() != constituency.upper():
            queries.append(f"{town}, {county} County, Kenya")

    # Ensure at least 3 queries
    if len(queries) < 3:
        queries.append(f"{constituency} constituency, {county}, Kenya")

    return queries


# ── Multi-Source Resolver with Cross-Validation ───────────────────────────────

def resolve_office_crossvalidated(office: Dict, expected_county: Optional[str]) -> Dict:
    """
    Run all geocoders with multiple queries, then cross-validate each result
    against the expected county. Returns {best_results, all_candidates, queries_used, rejected}.
    """
    # v9.3: Reduce queries for offices with existing coordinates
    current_lat = office.get("latitude")
    queries = build_queries(office)
    if current_lat is not None and len(queries) > 3:
        log.info(f"  ⚡ Office has coordinates -> reducing queries to 3 stages")
        queries = queries[:3]

    constituency = office.get("constituency_name") or office.get("constituency", "")
    county = office.get("county", "")
    location = office.get("office_location", "")
    landmark = office.get("landmark", "")

    all_candidates: List[Dict] = []
    rejected: List[Dict] = []
    queries_used: List[str] = []

    for qi, query in enumerate(queries):
        log.info(f"  🔍 Query {qi + 1}/{len(queries)}: '{query}'")
        queries_used.append(query)

        # Nominatim — returns multiple
        nom_results = geocode_nominatim(query, limit=5)
        for r in nom_results:
            r["query_used"] = query
            r["query_index"] = qi
        all_candidates.extend(nom_results)

        # Geocode.xyz
        xyz_results = geocode_geocodexyz(query)
        for r in xyz_results:
            r["query_used"] = query
            r["query_index"] = qi
        all_candidates.extend(xyz_results)

        # Geokeo — returns multiple
        gk_results = geocode_geokeo(query)
        for r in gk_results:
            r["query_used"] = query
            r["query_index"] = qi
        all_candidates.extend(gk_results)

        # v9.1: ArcGIS — enterprise-grade, key rotation
        arc_results = geocode_arcgis(query)
        for r in arc_results:
            r["query_used"] = query
            r["query_index"] = qi
        all_candidates.extend(arc_results)

        # v9.1: Photon (Komoot) — OSM-backed
        ph_results = geocode_photon(query)
        for r in ph_results:
            r["query_used"] = query
            r["query_index"] = qi
        all_candidates.extend(ph_results)

        # v9.1: OpenAI — High-precision fallback (moved out of loop v9.3)
        # oa_results = geocode_openai(query)
        # ...

    # v9.3 Escalation Check: If Nominatim/ArcGIS/Geokeo find 2+ validated candidates, SKIP AI
    validated_so_far = []
    # Temporary validation loop for early candidates
    for c in all_candidates:
        if not expected_county:
            validated_so_far.append(c)
        else:
            api_county = normalize_county(c.get("county_from_api", ""))
            exp_county = normalize_county(expected_county)
            if api_county and (api_county == exp_county or exp_county in api_county or api_county in exp_county):
                validated_so_far.append(c)

    if len(validated_so_far) >= 2:
        log.info(f"  ✨ Short-circuit: found {len(validated_so_far)} validated candidates. Skipping Gemini/OpenAI.")
    else:
        # Gemini AI — single call with full context
        log.info(f"  🔍 Querying Gemini AI...")
        gem_results = geocode_gemini(constituency, county, location, landmark)
        for r in gem_results:
            r["query_used"] = "gemini_structured_prompt"
            r["query_index"] = -1
        all_candidates.extend(gem_results)

        # v9.3: OpenAI — Single call per office only if needed
        if not all_candidates or len(validated_so_far) < 1:
            log.info(f"  🔍 Querying OpenAI fallback...")
            # Use most specific query for OpenAI
            best_q = queries[-1]
            oa_results = geocode_openai(best_q)
            for r in oa_results:
                r["query_used"] = best_q
                r["query_index"] = -3
            all_candidates.extend(oa_results)

    # v9.1: Stage 7 — PDF Extraction Fallback
    if _pdf_extraction_data:
        pdf_row = next((r for r in _pdf_extraction_data
                        if r.get("constituency_name", "").strip().upper() == constituency.strip().upper()), None)
        if pdf_row:
            pdf_loc = pdf_row.get("office_location", "")
            pdf_lnd = pdf_row.get("landmark", "")
            pq = f"{pdf_loc}, {pdf_lnd}, {constituency}, {county} County, Kenya"
            log.info(f"  \U0001f50d Stage 7 PDF: '{pq}'")
            queries_used.append(pq)
            # Re-query top sources with PDF-derived data
            for geocoder_fn in [geocode_arcgis, geocode_nominatim]:
                pdf_results = geocoder_fn(pq) if geocoder_fn != geocode_nominatim else geocoder_fn(pq, limit=3)
                for r in pdf_results:
                    r["query_used"] = pq
                    r["query_index"] = 7  # Stage 7
                all_candidates.extend(pdf_results)

    # Check contribution data
    office_id = office.get("id")
    if office_id:
        contributions = fetch_contributions_for_office(office_id)
        for contrib in contributions:
            clat = contrib.get("submitted_latitude")
            clng = contrib.get("submitted_longitude")
            if clat and clng and is_in_kenya(clat, clng):
                conf = min((contrib.get("confidence_score") or 0.5), 1.0)
                conf_count = contrib.get("confirmation_count") or 0
                # Boost confidence for confirmed contributions
                if conf_count >= 3:
                    conf = min(conf + 0.2, 1.0)
                all_candidates.append({
                    "lat": clat, "lng": clng, "source": "contribution",
                    "confidence": conf,
                    "display_name": f"User contribution #{contrib['id']}",
                    "county_from_api": (contrib.get("submitted_county") or ""),
                    "query_used": "contribution_pipeline",
                    "query_index": -2,
                })
                log.info(f"    ✓ Contribution #{contrib['id']}: ({clat:.5f}, {clng:.5f}) "
                         f"conf={conf:.2f} confirmations={conf_count}")

    log.info(f"  📊 Total candidates: {len(all_candidates)}")

    if not all_candidates:
        return {"best_results": [], "all_candidates": [], "queries_used": queries_used, "rejected": []}

    # ── Cross-validation: filter candidates against expected county ──
    validated: List[Dict] = []
    for c in all_candidates:
        if not expected_county:
            validated.append(c)
            continue

        # First check: does the API-returned county match?
        api_county = normalize_county(c.get("county_from_api", ""))
        exp_county = normalize_county(expected_county)
        if api_county and (api_county == exp_county or exp_county in api_county or api_county in exp_county):
            c["validation_method"] = "api_county_match"
            validated.append(c)
            continue

        # Second check: Nominatim address data
        addr = c.get("address_data", {})
        if addr:
            addr_county = normalize_county(
                addr.get("county", "") or addr.get("state_district", "") or addr.get("state", "")
            )
            addr_county = re.sub(r"\s*COUNTY\s*$", "", addr_county)
            if addr_county and (addr_county == exp_county or exp_county in addr_county or addr_county in exp_county):
                c["validation_method"] = "address_county_match"
                validated.append(c)
                continue

        # Third check: reverse geocode the coordinates (expensive, do sparingly)
        # v9.1: Lower threshold for sources that never return county data (geocode_xyz)
        if c["confidence"] >= 0.3 or c.get("source") == "geocode_xyz":
            rev_county = reverse_geocode_county(c["lat"], c["lng"])
            if rev_county:
                rev_norm = normalize_county(rev_county)
                if rev_norm == exp_county or exp_county in rev_norm or rev_norm in exp_county:
                    c["validation_method"] = "reverse_geocode_match"
                    validated.append(c)
                    continue

        # v9.1: Fourth check — Ward-level precision with cached reverse geocode
        if c["confidence"] >= 0.4:
            ok, reason = validate_coords_precision(
                c["lat"], c["lng"], expected_county,
                office.get("constituency_name") or office.get("constituency", ""),
                c.get("address_data"),
            )
            if ok:
                c["validation_method"] = f"precision_{reason}"
                if reason == "ward_match":
                    c["confidence"] = min(c["confidence"] + 0.15, 1.0)
                    c["source"] = c["source"] + "_ward_boost"
                validated.append(c)
                continue

        # Not validated — reject with reason
        c["rejection_reason"] = f"County mismatch: expected '{expected_county}', API returned '{c.get('county_from_api', 'unknown')}'"
        rejected.append(c)

    log.info(f"  ✅ Validated: {len(validated)} | ❌ Rejected: {len(rejected)}")

    return {
        "best_results": validated,
        "all_candidates": all_candidates,
        "queries_used": queries_used,
        "rejected": rejected,
    }


# ── Consensus Engine ──────────────────────────────────────────────────────────

def compute_consensus(results: List[Dict]) -> Optional[Dict]:
    """
    Cluster results within CONSENSUS_RADIUS_KM and pick the cluster with the
    highest cumulative confidence.

    Confidence formula:
      composite = (agreementRatio × 0.6) + (avgSourceConfidence × 0.4)
    """
    if not results:
        return None

    groups: List[List[Dict]] = []
    for r in results:
        placed = False
        for g in groups:
            dist = haversine_km(r["lat"], r["lng"], g[0]["lat"], g[0]["lng"])
            if dist <= CONSENSUS_RADIUS_KM:
                g.append(r)
                placed = True
                break
        if not placed:
            groups.append([r])

    # Sort by cumulative confidence
    groups.sort(key=lambda g: sum(x["confidence"] for x in g), reverse=True)
    winner = groups[0]

    avg_lat = sum(x["lat"] for x in winner) / len(winner)
    avg_lng = sum(x["lng"] for x in winner) / len(winner)
    agreement = len(winner) / len(results)
    avg_conf = sum(x["confidence"] for x in winner) / len(winner)
    composite = agreement * 0.6 + avg_conf * 0.4
    spread = max(haversine_km(x["lat"], x["lng"], avg_lat, avg_lng) for x in winner)

    return {
        "lat": avg_lat,
        "lng": avg_lng,
        "confidence": min(composite, 1.0),
        "agreement_count": len(winner),
        "spread_km": spread,
        "sources": [x["source"] for x in winner],
        "source_details": winner,
    }


# ── Cluster / Duplicate Detection ─────────────────────────────────────────────

def strip_cardinal(name: str) -> str:
    """Remove cardinal suffixes (NORTH, SOUTH, EAST, WEST, CENTRAL) from a name."""
    parts = name.strip().upper().split()
    core = [p for p in parts if p.lower() not in CARDINAL_SUFFIXES]
    return " ".join(core) if core else name.strip().upper()


def detect_clusters(offices: List[Dict]) -> List[Dict]:
    """
    Detect offices that share identical/very-close coordinates AND have
    related names (same base name with cardinal suffixes, or same county).
    Returns a list of cluster info dicts.
    """
    clusters = []
    seen_ids = set()

    for i, a in enumerate(offices):
        if a["id"] in seen_ids:
            continue
        a_lat = a.get("latitude")
        a_lng = a.get("longitude")
        if a_lat is None or a_lng is None:
            continue

        cluster_members = [a]
        for j, b in enumerate(offices):
            if i == j or b["id"] in seen_ids:
                continue
            b_lat = b.get("latitude")
            b_lng = b.get("longitude")
            if b_lat is None or b_lng is None:
                continue

            dist = haversine_km(a_lat, a_lng, b_lat, b_lng)
            if dist <= CLUSTER_DETECTION_KM:
                # Check if names are related (cardinal variants or same county)
                a_name = (a.get("constituency_name") or a.get("constituency", "")).upper()
                b_name = (b.get("constituency_name") or b.get("constituency", "")).upper()
                a_county = (a.get("county") or "").upper()
                b_county = (b.get("county") or "").upper()

                a_base = strip_cardinal(a_name)
                b_base = strip_cardinal(b_name)

                is_cardinal_variant = (a_base == b_base and a_name != b_name)
                is_same_county = (a_county == b_county)
                is_exact_dupe = (a_lat == b_lat and a_lng == b_lng)
                is_cross_county = (a_county != b_county and is_exact_dupe)

                if is_cardinal_variant or is_same_county or is_exact_dupe or is_cross_county:
                    cluster_members.append(b)

        if len(cluster_members) > 1:
            member_ids = [m["id"] for m in cluster_members]
            seen_ids.update(member_ids)

            names_summary = [f"{m.get('constituency_name') or m.get('constituency', '')}/{m.get('county', '')}" for m in cluster_members]
            cluster_type = "cardinal_variant"
            if any((m.get("county") or "").upper() != (cluster_members[0].get("county") or "").upper() for m in cluster_members[1:]):
                cluster_type = "cross_county_duplicate"
            elif all(m.get("latitude") == a_lat and m.get("longitude") == a_lng for m in cluster_members):
                cluster_type = "exact_duplicate"
            else:
                cluster_type = "proximity_cluster"

            clusters.append({
                "type": cluster_type,
                "center_lat": a_lat,
                "center_lng": a_lng,
                "member_ids": member_ids,
                "members": names_summary,
                "distance_m": max(haversine_km(a_lat, a_lng, m.get("latitude", a_lat), m.get("longitude", a_lng)) * 1000 for m in cluster_members),
            })

    return clusters


def detect_case_duplicates(offices: List[Dict]) -> List[Dict]:
    """Detect case-sensitivity duplicates (same constituency, different county casing)."""
    seen: Dict[str, List[Dict]] = {}
    for o in offices:
        key = (o.get("constituency_name") or o.get("constituency", "")).strip().upper()
        seen.setdefault(key, []).append(o)

    dupes = []
    for key, members in seen.items():
        if len(members) > 1:
            counties = set(m.get("county", "") for m in members)
            if len(counties) != len(members):
                # Same constituency appearing multiple times
                dupes.append({
                    "type": "case_duplicate",
                    "constituency": key,
                    "member_ids": [m["id"] for m in members],
                    "counties": list(counties),
                })
    return dupes


# ── Supabase Operations ──────────────────────────────────────────────────────

def fetch_all_offices() -> List[Dict]:
    """Fetch ALL offices from Supabase."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/iebc_offices"
        f"?select=id,constituency,constituency_name,constituency_code,county,"
        f"office_location,latitude,longitude,landmark,landmark_type,landmark_subtype,"
        f"direction_type,direction_landmark,direction_distance,distance_from_landmark,"
        f"geocode_queries,geocode_query,geocode_method,geocode_confidence,geocode_status,"
        f"formatted_address,verified,verified_latitude,verified_longitude,"
        f"clean_office_location,notes,source,submission_method,submission_source,"
        f"accuracy_meters,verified_at,verified_by,confidence_score,"
        f"image_url,contributor_image_url,created_from_contribution_id,"
        f"linked_contribution_ids,importance_score,result_type,"
        f"successful_geocode_query,total_queries_tried"
        f"&order=id",
        headers=HEADERS, timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def apply_resolution(office_id: int, lat: float, lng: float, confidence: float,
                     direction_meta: Dict, queries_used: List[str],
                     successful_query: str, formatted_addr: str,
                     consensus: Optional[Dict]) -> bool:
    """Update an office's coordinates and ALL metadata in Supabase."""
    payload = {
        "latitude": lat,
        "longitude": lng,
        "geocode_verified": True,
        "geocode_verified_at": datetime.now(timezone.utc).isoformat(),
        "multi_source_confidence": confidence,
        "geocode_method": "multi_source_crossvalidated",
        "geocode_confidence": confidence,
        "geocode_status": "resolved",
        "geocode_queries": json.dumps(queries_used) if queries_used else None,
        "geocode_query": successful_query or None,
        "successful_geocode_query": successful_query or None,
        "total_queries_tried": len(queries_used),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Direction metadata
    if direction_meta.get("direction_type"):
        payload["direction_type"] = direction_meta["direction_type"]
    if direction_meta.get("direction_landmark"):
        payload["direction_landmark"] = direction_meta["direction_landmark"]
    if direction_meta.get("direction_distance") is not None:
        payload["direction_distance"] = direction_meta["direction_distance"]
    if direction_meta.get("distance_from_landmark") is not None:
        payload["distance_from_landmark"] = direction_meta["distance_from_landmark"]
    if direction_meta.get("landmark_type"):
        payload["landmark_type"] = direction_meta["landmark_type"]
    if direction_meta.get("landmark_subtype"):
        payload["landmark_subtype"] = direction_meta["landmark_subtype"]

    # Formatted address from best source
    if formatted_addr:
        payload["formatted_address"] = formatted_addr

    # Confidence score
    payload["confidence_score"] = confidence

    # Result type
    if consensus:
        sources = consensus.get("sources", [])
        if "contribution" in sources:
            payload["result_type"] = "contribution_validated"
        elif len(sources) >= 3:
            payload["result_type"] = "multi_source_consensus"
        else:
            payload["result_type"] = "cross_validated"

    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/iebc_offices?id=eq.{office_id}",
        headers=HEADERS,
        json=payload,
        timeout=10,
    )
    if resp.status_code in (200, 204):
        return True

    # v9.1: Log the actual error and retry with core-only columns
    log.warning(f"  DB full-payload update failed ({resp.status_code}): {resp.text[:300]}")
    core_payload = {
        "latitude": lat,
        "longitude": lng,
        "geocode_confidence": confidence,
        "geocode_method": "multi_source_crossvalidated",
        "geocode_status": "resolved",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    resp2 = requests.patch(
        f"{SUPABASE_URL}/rest/v1/iebc_offices?id=eq.{office_id}",
        headers=HEADERS,
        json=core_payload,
        timeout=10,
    )
    if resp2.status_code in (200, 204):
        log.info(f"  ✅ Core-only fallback succeeded for office {office_id}")
        return True
    log.error(f"  ❌ Core-only fallback also failed ({resp2.status_code}): {resp2.text[:300]}")
    return False


def log_audit(office: Dict, issue_type: str, new_lat: float, new_lng: float,
              consensus: Optional[Dict], applied: bool) -> Optional[str]:
    """Write an audit record to geocode_audit."""
    payload = {
        "office_id": office["id"],
        "constituency": office.get("constituency_name") or office.get("constituency", ""),
        "county": office.get("county", ""),
        "issue_type": issue_type,
        "old_latitude": office.get("latitude"),
        "old_longitude": office.get("longitude"),
        "new_latitude": new_lat,
        "new_longitude": new_lng,
        "consensus_confidence": consensus["confidence"] if consensus else None,
        "agreement_count": consensus["agreement_count"] if consensus else None,
        "spread_km": consensus["spread_km"] if consensus else None,
        "sources_used": consensus["sources"] if consensus else [],
        "source_results": consensus["source_details"] if consensus else [],
        "resolution_method": "multi_source_crossvalidated",
        "applied": applied,
    }
    try:
        resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/geocode_audit",
            headers=HEADERS,
            json=payload,
            timeout=10,
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            return data[0]["id"] if data else None
    except Exception as e:
        log.warning(f"  Audit log failed: {e}")
    return None


def enqueue_hitl(office: Dict, consensus: Optional[Dict], issue_type: str, audit_id: Optional[str]):
    """Add low-confidence resolution to admin HITL queue."""
    payload = {
        "office_id": office["id"],
        "audit_id": audit_id,
        "issue_type": issue_type,
        "proposed_latitude": consensus["lat"] if consensus else None,
        "proposed_longitude": consensus["lng"] if consensus else None,
        "confidence": consensus["confidence"] if consensus else None,
        "agreement_count": consensus["agreement_count"] if consensus else None,
        "spread_km": consensus["spread_km"] if consensus else None,
        "source_details": consensus["source_details"] if consensus else [],
        "status": "pending",
    }
    try:
        requests.post(
            f"{SUPABASE_URL}/rest/v1/geocode_hitl_queue",
            headers=HEADERS,
            json=payload,
            timeout=10,
        )
    except Exception as e:
        log.warning(f"  HITL enqueue failed: {e}")


# ── Fetch Flagged Offices (legacy path) ───────────────────────────────────────

def fetch_flagged_offices() -> List[Dict]:
    """Load the latest verification report and extract flagged office IDs."""
    report_path = Path("reports/latest_verification.json")
    if not report_path.exists():
        log.error("No verification report found at reports/latest_verification.json")
        return []

    with open(report_path) as f:
        report = json.load(f)

    office_ids = set()
    for issue in report.get("issues", []):
        if issue.get("severity") == "critical" and issue.get("type") == "county_mismatch":
            office_ids.add(issue["office_id"])
        elif issue.get("type") == "clustering":
            for key in ["office_a_id", "office_b_id"]:
                if key in issue:
                    office_ids.add(issue[key])

    if not office_ids:
        log.info("No flagged offices found in verification report")
        return []

    ids_csv = ",".join(str(oid) for oid in office_ids)
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/iebc_offices?id=in.({ids_csv})"
        f"&select=id,constituency,constituency_name,constituency_code,county,"
        f"office_location,latitude,longitude,landmark,landmark_type,landmark_subtype,"
        f"direction_type,direction_landmark,direction_distance,distance_from_landmark,"
        f"geocode_queries,geocode_query,geocode_method,geocode_confidence,geocode_status,"
        f"formatted_address,verified,clean_office_location,notes,source",
        headers={**HEADERS},
        timeout=15,
    )
    resp.raise_for_status()
    offices = resp.json()
    log.info(f"Fetched {len(offices)} flagged offices from database")
    return offices


# ── Main Pipeline ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Multi-Source Cross-Validated IEBC Coordinate Resolver")
    parser.add_argument("--apply", action="store_true", help="Write resolved coords to Supabase")
    parser.add_argument("--all", action="store_true", help="Resolve ALL offices in the database")
    parser.add_argument("--office-id", type=int, help="Resolve a single office by ID")
    parser.add_argument("--max-resolve", type=int, default=999, help="Max offices to resolve in batch")
    parser.add_argument("--json-output", action="store_true", help="Output JSON summary")
    parser.add_argument("--skip-clusters", action="store_true", help="Skip cluster detection phase")
    args = parser.parse_args()

    mode_label = "APPLY (LIVE)" if args.apply else "DRY RUN"
    log.info("=" * 70)
    log.info("MULTI-SOURCE CROSS-VALIDATED GEOCODING RESOLVER")
    log.info(f"Mode: {mode_label}")
    log.info("=" * 70)

    # Load DB reference data for cross-validation
    load_reference_data()

    # Fetch offices to resolve
    if args.office_id:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/iebc_offices?id=eq.{args.office_id}"
            f"&select=id,constituency,constituency_name,constituency_code,county,"
            f"office_location,latitude,longitude,landmark,landmark_type,landmark_subtype,"
            f"direction_type,direction_landmark,direction_distance,distance_from_landmark,"
            f"geocode_queries,geocode_query,geocode_method,geocode_confidence,geocode_status,"
            f"formatted_address,verified,clean_office_location,notes,source",
            headers=HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        offices = resp.json()
    elif args.all:
        log.info("Fetching ALL offices from database...")
        offices = fetch_all_offices()
    else:
        offices = fetch_flagged_offices()

    if not offices:
        log.info("No offices to resolve.")
        return

    # ── Phase 1: Cluster Detection ────────────────────────────────────────────
    if not args.skip_clusters and not args.office_id:
        log.info("")
        log.info("=" * 70)
        log.info("PHASE 1: CLUSTER & DUPLICATE DETECTION")
        log.info("=" * 70)

        clusters = detect_clusters(offices)
        case_dupes = detect_case_duplicates(offices)

        if clusters:
            log.info(f"  Found {len(clusters)} coordinate clusters:")
            cluster_office_ids = set()
            for cl in clusters:
                log.info(f"    [{cl['type']}] {cl['members']} dist={cl['distance_m']:.0f}m")
                cluster_office_ids.update(cl["member_ids"])

            # Prioritize clustered offices — move them to front of the list
            clustered = [o for o in offices if o["id"] in cluster_office_ids]
            non_clustered = [o for o in offices if o["id"] not in cluster_office_ids]
            log.info(f"  Prioritizing {len(clustered)} clustered offices for resolution")
            offices = clustered + non_clustered
        else:
            log.info("  No clusters detected ✓")

        if case_dupes:
            log.info(f"  Found {len(case_dupes)} case-sensitivity duplicates:")
            for d in case_dupes:
                log.info(f"    {d['constituency']}: IDs {d['member_ids']} counties={d['counties']}")

    offices = offices[:args.max_resolve]
    log.info("")
    log.info("=" * 70)
    log.info(f"PHASE 2: CROSS-VALIDATED RESOLUTION ({len(offices)} offices)")
    log.info("=" * 70)

    stats = {
        "resolved": 0, "auto_applied": 0, "hitl_queued": 0,
        "no_consensus": 0, "no_validated_candidates": 0,
        "skipped_accurate": 0, "total": len(offices),
    }
    results_log = []

    for i, office in enumerate(offices, 1):
        name = office.get("constituency_name") or office.get("constituency", f"ID:{office['id']}")
        county = office.get("county", "Unknown")
        log.info(f"\n[{i}/{len(offices)}] {name} ({county})")

        # Look up expected county from DB
        expected_county = expected_county_for_constituency(name)
        if expected_county:
            if normalize_county(county) != normalize_county(expected_county):
                log.warning(f"  ⚠️  Office says county='{county}' but DB says constituency '{name}' → county='{expected_county}'")
        else:
            expected_county = county  # Fall back to the office's own county

        # Extract direction metadata
        direction_meta = extract_direction_metadata(
            office.get("office_location", ""),
            office.get("landmark", ""),
        )
        if direction_meta.get("direction_type"):
            log.info(f"  📍 Direction: {direction_meta['direction_type']} | "
                     f"Landmark: {direction_meta.get('direction_landmark', 'N/A')} | "
                     f"Distance: {direction_meta.get('direction_distance', 'N/A')}m | "
                     f"Type: {direction_meta.get('landmark_type', 'N/A')}")

        # Run cross-validated multi-source resolver
        resolution = resolve_office_crossvalidated(office, expected_county)
        validated = resolution["best_results"]
        queries_used = resolution["queries_used"]
        rejected = resolution["rejected"]

        if rejected:
            log.info(f"  🚫 Rejected {len(rejected)} candidates (wrong county)")
            for rej in rejected[:3]:
                log.info(f"     ❌ {rej['source']}: ({rej['lat']:.5f},{rej['lng']:.5f}) — {rej.get('rejection_reason','')}")

        # Compute consensus from validated results only
        consensus = compute_consensus(validated)

        if consensus:
            log.info(f"  ✅ Consensus: ({consensus['lat']:.5f}, {consensus['lng']:.5f}) "
                     f"conf={consensus['confidence']:.2f} agree={consensus['agreement_count']}/{len(validated)} "
                     f"spread={consensus['spread_km']:.2f}km")

            # Check displacement from current coords
            old_lat = office.get("latitude")
            old_lng = office.get("longitude")
            if old_lat is not None and old_lng is not None:
                displacement = haversine_km(old_lat, old_lng, consensus["lat"], consensus["lng"])
                log.info(f"  📐 Displacement from current: {displacement:.1f} km")
            else:
                displacement = 999  # null coords always need fixing

            issue_type = "NULL_COORDS" if (old_lat is None or old_lng is None) else "DISPLACED"

            # Find best display name for formatted_address
            formatted_addr = ""
            successful_query = ""
            for s in consensus.get("source_details", []):
                if s.get("display_name") and len(s["display_name"]) > len(formatted_addr):
                    formatted_addr = s["display_name"]
                if s.get("query_used"):
                    successful_query = s["query_used"]

            if displacement <= DISPLACEMENT_THRESHOLD_KM:
                log.info(f"  ⏭️  Current coords are close enough — updating metadata only")
                if args.apply:
                    # Still update direction metadata and geocode info even if coords are fine
                    payload = {
                        "geocode_status": "verified_accurate",
                        "geocode_method": "multi_source_crossvalidated",
                        "geocode_confidence": consensus["confidence"],
                        "geocode_queries": json.dumps(queries_used),
                        "geocode_query": successful_query or None,
                        "successful_geocode_query": successful_query or None,
                        "total_queries_tried": len(queries_used),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "multi_source_confidence": consensus["confidence"],
                        "confidence_score": consensus["confidence"],
                    }
                    if direction_meta.get("direction_type"):
                        payload["direction_type"] = direction_meta["direction_type"]
                    if direction_meta.get("direction_landmark"):
                        payload["direction_landmark"] = direction_meta["direction_landmark"]
                    if direction_meta.get("direction_distance") is not None:
                        payload["direction_distance"] = direction_meta["direction_distance"]
                    if direction_meta.get("distance_from_landmark") is not None:
                        payload["distance_from_landmark"] = direction_meta["distance_from_landmark"]
                    if direction_meta.get("landmark_type"):
                        payload["landmark_type"] = direction_meta["landmark_type"]
                    if formatted_addr:
                        payload["formatted_address"] = formatted_addr

                    requests.patch(
                        f"{SUPABASE_URL}/rest/v1/iebc_offices?id=eq.{office['id']}",
                        headers=HEADERS, json=payload, timeout=10,
                    )

                stats["skipped_accurate"] += 1
                stats["resolved"] += 1
                results_log.append({
                    "office_id": office["id"], "action": "skip_metadata_updated",
                    "displacement_km": displacement,
                    "confidence": consensus["confidence"],
                })
                continue

            if consensus["confidence"] >= AUTO_APPLY_THRESHOLD:
                if args.apply:
                    ok = apply_resolution(
                        office["id"], consensus["lat"], consensus["lng"],
                        consensus["confidence"], direction_meta, queries_used,
                        successful_query, formatted_addr, consensus,
                    )
                    log_audit(office, issue_type, consensus["lat"], consensus["lng"], consensus, ok)
                    if ok:
                        log.info(f"  ✅ APPLIED to database")
                        stats["auto_applied"] += 1
                    else:
                        log.error(f"  ❌ Database update failed")
                else:
                    log.info(f"  🔒 Would apply (dry run)")
                    stats["auto_applied"] += 1
                stats["resolved"] += 1
                results_log.append({
                    "office_id": office["id"], "action": "auto_apply",
                    "new_lat": consensus["lat"], "new_lng": consensus["lng"],
                    "confidence": consensus["confidence"],
                    "sources": consensus["sources"],
                    "queries_used": queries_used,
                })
            else:
                # Low confidence → HITL queue
                if args.apply:
                    audit_id = log_audit(office, issue_type, consensus["lat"], consensus["lng"], consensus, False)
                    enqueue_hitl(office, consensus, issue_type, audit_id)
                log.info(f"  ⚠️  Low confidence ({consensus['confidence']:.2f}) → queued for admin review")
                stats["hitl_queued"] += 1
                results_log.append({
                    "office_id": office["id"], "action": "hitl_queue",
                    "proposed_lat": consensus["lat"], "proposed_lng": consensus["lng"],
                    "confidence": consensus["confidence"],
                    "queries_used": queries_used,
                })
        elif validated:
            # We have validated candidates but no consensus cluster
            log.warning(f"  ⚠️  {len(validated)} validated candidates but no consensus cluster")
            stats["no_consensus"] += 1
            if args.apply:
                enqueue_hitl(office, None, "NO_CLUSTER", None)
            results_log.append({"office_id": office["id"], "action": "no_consensus_validated"})
        else:
            if resolution["all_candidates"]:
                log.warning(f"  ❌ {len(resolution['all_candidates'])} candidates but ALL rejected (wrong county)")
                stats["no_validated_candidates"] += 1
            else:
                log.warning(f"  ❌ No results from any source")
                stats["no_consensus"] += 1
            if args.apply:
                issue_type = "NULL_COORDS" if (office.get("latitude") is None) else "COUNTY_MISMATCH"
                enqueue_hitl(office, None, issue_type, None)
            results_log.append({"office_id": office["id"], "action": "no_validated_candidates"})

        # v9.3: Save persistent cache after each office resolution
        save_rev_geo_cache()

    # ── Summary ───────────────────────────────────────────────────────────────
    log.info("")
    log.info("=" * 70)
    log.info("RESOLUTION SUMMARY")
    log.info(f"  Total offices:              {stats['total']}")
    log.info(f"  Resolved:                   {stats['resolved']}")
    log.info(f"  Auto-applied (coord fix):   {stats['auto_applied']}")
    log.info(f"  Skipped (accurate + meta):  {stats['skipped_accurate']}")
    log.info(f"  HITL queued:                {stats['hitl_queued']}")
    log.info(f"  No consensus:               {stats['no_consensus']}")
    log.info(f"  Rejected (wrong county):    {stats['no_validated_candidates']}")
    log.info("=" * 70)

    if args.json_output:
        Path("reports").mkdir(exist_ok=True)
        output_path = Path("reports/latest_resolution.json")
        with open(output_path, "w") as f:
            json.dump({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "mode": mode_label,
                "stats": stats,
                "results": results_log,
            }, f, indent=2)
        log.info(f"JSON output saved to {output_path}")


if __name__ == "__main__":
    main()
