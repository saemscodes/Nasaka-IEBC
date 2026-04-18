#!/usr/bin/env python3
"""
Multi-Source Cross-Validated Geocoding Resolver for Nasaka IEBC

Queries Nominatim, Geocode.xyz, Geokeo, and Gemini AI to find the most
accurate coordinate for each IEBC office.  Uses weighted-cluster voting,
DB cross-validation (constituencyâ†’county), reverse geocoding checks,
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
import csv
import json
import time
import random
import math
import logging
import argparse
import requests
import threading
import psycopg2
from urllib.parse import urlparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple, Any

# Internal Admin Task Library
try:
    from admin_task_lib import AdminTask
    HAS_ADMIN_LIB = True
except ImportError:
    AdminTask = None
    HAS_ADMIN_LIB = False

# Load .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


_last_env_mtime = 0.0

def get_secret(key_name: str, default: str = "") -> str:
    """v10.8.1: Smarter hot-reload. Only reloads .env if the file has changed on disk."""
    global _last_env_mtime
    try:
        env_path = os.path.join(os.getcwd(), '.env')
        if os.path.exists(env_path):
            current_mtime = os.path.getmtime(env_path)
            if current_mtime > _last_env_mtime:
                load_dotenv(dotenv_path=env_path, override=True)
                _last_env_mtime = current_mtime
        val = os.getenv(key_name, default) or ""
        # [STRICT] Strip quotes that commony cause 401 Unauthorized in GHA
        return val.strip("'\"").strip() if isinstance(val, str) else val
    except Exception:
        return os.getenv(key_name, default) or ""

# â”€â”€ Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ftswzvqwxdwgkvfbwfpx.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_ANON_KEY", ""))

# v10.8 Note: API keys below are now loaded dynamically via get_secret() in each function
# to support hot-reloading mid-run without process restart.

DOMAIN = os.getenv("DOMAIN", "nasakaiebc.civiceducationkenya.com")
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

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
NOMINATIM_RATE_LIMIT = 1.2  # Safe 1.2s delay to avoid IP blocks (v9.4)

# v9.3: RateLimiter class to enforce mandatory sleeps between API calls
class RateLimiter:
    """Monotonic rate limiter: enforces min interval between calls (v9.4)."""
    def __init__(self, min_interval_seconds: float):
        self.min_interval = float(min_interval_seconds)
        self.last_call = 0.0
        self._lock = threading.Lock()

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            elapsed = now - self.last_call
            wait_time = self.min_interval - elapsed
            if wait_time > 0:
                time.sleep(wait_time)
                now = time.monotonic()
            self.last_call = now

RATE_LIMITERS = {
    "google":      RateLimiter(0.02),  # v11.1: Google is fast (50/s)
    "nominatim":   RateLimiter(NOMINATIM_RATE_LIMIT),
    "gemini":      RateLimiter(4.0),
    "openai":      RateLimiter(6.0),
    "arcgis":      RateLimiter(0.5),
    "geokeo":      RateLimiter(1.0),
    "geocode_xyz": RateLimiter(1.1),
    "photon":      RateLimiter(1.1),
    "locationiq":  RateLimiter(1.1),   # v9.5: 1 req/s
    "geoapify":    RateLimiter(0.33),  # v9.5: 3 req/s
    "opencage":    RateLimiter(1.1),   # v9.5: 1 req/s
    "groq":        RateLimiter(1.0),   # v9.5
    "hf":          RateLimiter(0.5),   # v9.5
    "geocode_earth": RateLimiter(0.1),  # v10.2: geocode.earth supports 10 req/s
    "geonames":    RateLimiter(1.0),   # v10.3: GeoNames recommends 1s delay for free accounts
    "manus":       RateLimiter(2.0),   # v10.7: Manus AI
    "deepseek":    RateLimiter(2.0),   # v10.9
    "cerebras":    RateLimiter(1.0),   # v10.9
    "cohere":      RateLimiter(1.0),   # v10.9
    "nvidia":      RateLimiter(1.0),   # v10.9
    "openrouter":  RateLimiter(1.0),   # v10.9
    "positionstack": RateLimiter(1.0), # v10.9
    "geocodemaps": RateLimiter(1.0),   # v10.9
    "bigdatacloud": RateLimiter(1.0),  # v10.9
    "overpass":    RateLimiter(5.0),   # v10.9
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("resolve")

# ── Stratified Matrix v11.1 Configuration ─────────────────────────────────────
# [STRICT] Tier 1 is Landmark-FREE for Premium providers (v7.3 Standard)
TIER_TEMPLATES = [
    lambda r, skipL=False: f"{r['office_location']}, {r['ward']}, {r['constituency']}, {r['county']} County, Kenya" if skipL else f"{r['office_location']} near {r.get('landmark','')}, {r['ward']}, {r['constituency']}, {r['county']} County, Kenya",
    lambda r, _: f"{r['office_location']}, {r['constituency']}, {r['county']} County, Kenya",
    lambda r, _: f"{r['office_location']}, {r['constituency']}, Kenya",
    lambda r, _: f"{r['constituency']} IEBC Registration Centre, Kenya"
]

def resolve_matrix_iebc(office: Dict) -> Dict:
    """Stratified Matrix Resolver v11.1 (Python Port).
    Classes: 1=Premium, 2=Reliable (Consensus), 3=Open (Consensus).
    """
    results = {"best_results": [], "queries_used": [], "status": "failed"}
    premium_fallback = None

    # CLASS 1: Premium (First Class)
    # [STRICT] Tier 1 is Landmark-FREE
    for ti, template in enumerate(TIER_TEMPLATES):
        query = template(office, skipL=(ti == 0))
        results["queries_used"].append(query)
        
        # Try Premium Providers
        for p_fn in [geocode_google, geocode_arcgis]:
            try:
                p_res = p_fn(query)
                for r in p_res:
                    # Gold Standard: ROOFTOP or RANGE (High Confidence)
                    if r.get("confidence", 0) >= 0.8:
                        log.info(f"  🏆 [CLASS 1] Gold Standard found via {r['source']} at Tier {ti+1}")
                        results["best_results"] = [r]
                        results["status"] = "resolved"
                        return results
                    # Silver Standard: GEOMETRIC (Save as fallback, but keep searching)
                    if not premium_fallback:
                        premium_fallback = r
            except Exception: continue

    # CLASS 2 & 3: Reliable & Open (Combined Exhaustion with Consensus)
    # [STRICT] Class 2+3 requires Corroboration (500m)
    consensus_pool = []
    
    # Provider Grouping
    reliable = [geocode_geoapify, geocode_opencage, geocode_locationiq, geocode_earth]
    open_p   = [geocode_nominatim, geocode_photon, geocode_geonames, geocode_geokeo]
    
    for ti, template in enumerate(TIER_TEMPLATES):
        query = template(office, skipL=False)
        if query not in results["queries_used"]: results["queries_used"].append(query)
        
        # Round 1: Try Reliable (Class 2)
        for r_fn in reliable:
            try:
                r_res = r_fn(query)
                consensus_pool.extend(r_res)
            except Exception: continue
            
        # Round 2: Try Open (Class 3)
        for o_fn in open_p:
            try:
                o_res = o_fn(query)
                consensus_pool.extend(o_res)
            except Exception: continue
            
        # Check for Corroboration (v7.3 Standard: 500m Match between DIFFERENT providers)
        if len(consensus_pool) >= 2:
            for i in range(len(consensus_pool)):
                for j in range(i + 1, len(consensus_pool)):
                    c1, c2 = consensus_pool[i], consensus_pool[j]
                    if c1["source"] == c2["source"]: continue # NO SELF-CORROBORATION
                    
                    dist = haversine_km(c1["lat"], c1["lng"], c2["lat"], c2["lng"])
                    if dist <= CONSENSUS_RADIUS_KM:
                        log.info(f"  🤝 [CLASS 2/3] Corroboration found ({dist:.2f}km) at Tier {ti+1}")
                        results["best_results"] = [c1, c2]
                        results["status"] = "resolved"
                        return results

    # FINAL ESCALATION
    if premium_fallback:
        log.info(f"  ⚠️ [CLASS 4] Exhaustion complete. Falling back to Premium Low-Confidence result.")
        results["best_results"] = [premium_fallback]
        results["status"] = "hitl_review"
        return results

    log.warning(f"  ❌ [EXHAUSTED] No valid result found across Matrix.")
    return results

def geocode_google(query: str) -> List[Dict]:
    """Premium Google Maps Geocoding (v11.1)."""
    api_key = get_secret("GOOGLE_MAPS_API_KEY")
    if not api_key: return []
    try:
        if "google" in RATE_LIMITERS: RATE_LIMITERS["google"].wait()
        resp = safe_request(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": query, "key": api_key, "region": "ke"}
        )
        if not resp: return []
        data = resp.json()
        results = []
        for r in data.get("results", []):
            lat, lng = r["geometry"]["location"]["lat"], r["geometry"]["location"]["lng"]
            if not is_in_kenya(lat, lng): continue
            results.append({
                "lat": lat, "lng": lng, "source": "google",
                "confidence": 1.0 if r["geometry"]["location_type"] == "ROOFTOP" else 0.7,
                "display_name": r.get("formatted_address", ""),
                "google_location_type": r["geometry"]["location_type"]
            })
        return results
    except Exception as e:
        log.warning(f"  Google failed: {e}")
        return []

# â”€â”€ Per-County Adaptive Thresholds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ADAPTIVE_THRESHOLDS_KM = {
    "turkana": 150, "marsabit": 200, "wajir": 150, "mandera": 200,
    "garissa": 150, "tana river": 120, "kitui": 100, "kajiado": 100,
    "narok": 100, "samburu": 100, "laikipia": 80, "baringo": 80,
    "west pokot": 80, "isiolo": 100, "makueni": 80, "machakos": 80,
    "kilifi": 80, "taita taveta": 80, "meru": 80, "nakuru": 80,
    "elgeyo-marakwet": 60,
}
DEFAULT_THRESHOLD_KM = 50

# â”€â”€ Cardinal direction variants for cluster detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CARDINAL_SUFFIXES = {"north", "south", "east", "west", "central"}

# v9.1: Sub-county to County mapping for Nominatim admin level mismatches
SUBCOUNTY_TO_COUNTY = {
    "CHANGAMWE": "MOMBASA",
    "JOMVU": "MOMBASA",
    "LIKONI": "MOMBASA",
    "GUCHA": "KISII",
    "GATUNDU SOUTH": "KIAMBU", "GATUNDU NORTH": "KIAMBU",
    "MASABA SOUTH": "KISII",
    "MT ELGON": "BUNGOMA",
    "KIMILILI": "BUNGOMA",
    "KISAUNI": "MOMBASA",
    "NYALI": "MOMBASA",
    "MVITA": "MOMBASA",
}

# â”€â”€ v10.0: Multi-Table Configuration (Additive) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
SUPPORTED_TABLES = {
    "iebc_offices": {
        "id": "id",
        "name": "constituency_name",
        "context": "county",
        "location": "office_location",
        "landmark": "landmark",
        "query_template": "{location}, {name}, {context}, Kenya",
        "validate_kenya": True,
        "select": "id,constituency,constituency_name,constituency_code,county,office_location,latitude,longitude,landmark,landmark_type,landmark_subtype,direction_type,direction_landmark,direction_distance,distance_from_landmark,geocode_queries,geocode_query,geocode_method,geocode_confidence,geocode_status,formatted_address,verified,clean_office_location,notes,source"
    },
    "diaspora_registration_centres": {
        "id": "id",
        "name": "mission_name",
        "context": "country",
        "location": "city",
        "landmark": "address",
        "query_template": "{name}, {location}, {context}",
        "validate_kenya": False,
        "select": "id,mission_name,city,country,continent,region,latitude,longitude,address,geocode_status,geocode_method,geocode_confidence,formatted_address"
    },
    "wards": {
        "id": "id",
        "name": "ward_name",
        "context": "county",
        "location": "constituency",
        "landmark": "",
        "query_template": "{name} Ward, {location}, {context}, Kenya",
        "validate_kenya": True,
        "select": "id,ward_name,constituency,county,latitude,longitude,total_voters,geocode_status,geocode_method,geocode_confidence,formatted_address"
    }
}

# â”€â”€ Direction-type keywords â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

# â”€â”€ Landmark-type patterns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


# â”€â”€ Haversine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


# â”€â”€ DB Reference Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

_constituency_county_map: Dict[str, str] = {}
_county_names: Dict[int, str] = {}
_constituency_wards: Dict[str, List[str]] = {}  # v9.1: Ward-level precision
_rev_geo_cache: Dict[Tuple[float, float], Dict[str, str]] = {}  # v9.1: Coordinate cache
_pdf_extraction_data: List[Dict] = []  # v9.1: PDF fallback data
_CIRCUIT_BREAKERS: Dict[str, Dict] = {}  # v9.3: Stores {"tripped": bool, "last_trip": float}
_ward_boundaries: List[Dict] = []  # v10.7: Ward polygon boundaries from GeoJSON
CACHE_FILE = Path("data/cache/rev_geo_cache.json")
MASTER_ARCHIVE_FILE = Path("data/MASTER_IEBC_RESOLVED.json")  # v11.0: E.V.E.R.Y.T.H.I.N.G Archive


# â”€â”€ Reliable Requests with Exponential Backoff & Circuit Breaker (v9.1) â”€â”€â”€â”€â”€â”€â”€

def safe_request(url: str, params: Optional[Dict] = None, method: str = "GET",
                 json_data: Optional[Dict] = None, headers: Optional[Dict] = None,
                 max_retries: int = 3, initial_delay: float = 2.0) -> Optional[requests.Response]:
    """Execute a request with exponential backoff and circuit breaker support (v9.4: monotonic + normalized)."""
    from urllib.parse import urlparse
    host = urlparse(url).netloc.lower()

    # Circuit breaker (v9.3): skip hosts that have been tripped within the last 5 minutes
    breaker = _CIRCUIT_BREAKERS.get(host)
    if breaker and breaker.get("tripped"):
        elapsed = time.monotonic() - breaker.get("last_trip", 0)
        if elapsed < 300:  # 5-minute cool-off
            return None
        else:
            log.info(f"  ðŸ”„ Circuit breaker reset for {host} (cool-off expired)")
            _CIRCUIT_BREAKERS[host] = {"tripped": False, "last_trip": 0}

    delay = initial_delay
    for attempt in range(max_retries + 1):
        try:
            if method.upper() == "GET":
                resp = requests.get(url, params=params, headers=headers or {"User-Agent": USER_AGENT}, timeout=20)
            else:
                resp = requests.post(url, json=json_data, headers=headers or {"User-Agent": USER_AGENT}, timeout=20)

            # Fast Fail on non-retryable status codes (v9.6)
            if resp.status_code == 404:
                return None # Not found is not a network failure
            
            if resp.status_code in (401, 403):
                log.error(f"  \u26d4 CIRCUIT BREAKER TRIPPED for {host} ({resp.status_code} Forbidden/Unauthorized)")
                _CIRCUIT_BREAKERS[host] = {"tripped": True, "last_trip": time.monotonic()}
                return None

            if resp.status_code == 200:
                return resp

            if resp.status_code == 429 or 500 <= resp.status_code < 600:
                if attempt < max_retries:
                    sleep_time = delay + random.uniform(0.1, 1.5)
                    log.warning(f"  Rate limited ({resp.status_code}). Retrying in {sleep_time:.1f}s (Attempt {attempt+1}/{max_retries})...")
                    time.sleep(sleep_time)
                    delay *= 2
                    continue
                else:
                    log.error(f"  âš  CIRCUIT BREAKER TRIPPED for {host} after {max_retries} retries")
                    _CIRCUIT_BREAKERS[host] = {"tripped": True, "last_trip": time.monotonic()}
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
                _CIRCUIT_BREAKERS[host] = {"tripped": True, "last_trip": time.monotonic()}
                return None
    return None


def load_reference_data():
    """Load constituenciesâ†’county mapping and county names from Supabase."""
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
    log.info(f"  Loaded {len(_constituency_county_map)} constituencyâ†’county mappings")

    # v9.1: Load wards for Ward-level precision
    load_ward_data()

    # v10.7: Load ward boundary polygons from GeoJSON
    load_ward_boundaries()

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


def load_ward_boundaries():
    """v10.7: Load ward polygon boundaries from GeoJSON for point-in-polygon validation."""
    global _ward_boundaries
    geojson_paths = [
        Path("public/context/Wards/kenya_wards.geojson"),
        Path("dist/context/Wards/kenya_wards.geojson"),
    ]
    geojson_path = None
    for p in geojson_paths:
        if p.exists():
            geojson_path = p
            break
    if not geojson_path:
        log.warning("  Ward boundaries GeoJSON not found (non-fatal)")
        return
    try:
        with open(str(geojson_path), "r", encoding="utf-8") as f:
            data = json.load(f)
        features = data.get("features", [])
        for feat in features:
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            geom_type = geom.get("type", "")
            coords = geom.get("coordinates", [])
            if not coords:
                continue
            # Normalize all polygons to a list of rings
            # Polygon: [[ring1], [ring2], ...]
            # MultiPolygon: [[[ring1], ...], [[ring1], ...], ...]
            rings = []
            if geom_type == "Polygon":
                rings = coords  # coords is [[lng,lat], ...] per ring
            elif geom_type == "MultiPolygon":
                for polygon in coords:
                    rings.extend(polygon)
            else:
                continue
            _ward_boundaries.append({
                "county": (props.get("county") or "").strip().upper(),
                "subcounty": (props.get("subcounty") or "").strip().upper(),
                "ward": (props.get("ward") or "").strip().upper(),
                "rings": rings,
            })
        log.info(f"  Loaded {len(_ward_boundaries)} ward boundaries from GeoJSON")
    except Exception as e:
        log.warning(f"  Ward boundaries load failed (non-fatal): {e}")


def point_in_polygon(lat: float, lng: float, ring: List) -> bool:
    """v10.7: Ray-casting algorithm for point-in-polygon test.
    Ring is a list of [lng, lat] coordinate pairs (GeoJSON format).
    """
    n = len(ring)
    inside = False
    x, y = lng, lat  # GeoJSON uses [lng, lat]
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def point_in_ward(lat: float, lng: float, ward_entry: Dict) -> bool:
    """v10.7: Check if a point falls inside a ward's polygon (handles multi-ring)."""
    rings = ward_entry.get("rings", [])
    if not rings:
        return False
    # First ring is the outer boundary
    if not point_in_polygon(lat, lng, rings[0]):
        return False
    # Subsequent rings are holes â€” point must NOT be in any hole
    for hole in rings[1:]:
        if point_in_polygon(lat, lng, hole):
            return False
    return True


def validate_point_in_boundary(lat: float, lng: float, expected_county: str,
                               expected_constituency: str = "") -> Tuple[bool, str]:
    """v10.7: Validate that coordinates fall within the correct ward/constituency/county boundary.
    Returns (is_valid, detail_string).
    """
    if not _ward_boundaries:
        return True, "no_boundary_data"  # Cannot validate, pass through

    exp_county = normalize_county(expected_county)
    exp_constituency = expected_constituency.strip().upper() if expected_constituency else ""

    # First: check if point falls in ANY ward within the expected county
    county_wards = [w for w in _ward_boundaries if normalize_county(w["county"]) == exp_county]
    if not county_wards:
        return True, f"no_boundary_for_county_{exp_county}"  # No boundary data for this county

    # Check constituency-level match first (subcounty in GeoJSON = constituency)
    if exp_constituency:
        constituency_wards = [w for w in county_wards if w["subcounty"] == exp_constituency]
        for ward_entry in constituency_wards:
            if point_in_ward(lat, lng, ward_entry):
                return True, f"boundary_match:ward={ward_entry['ward']},constituency={ward_entry['subcounty']},county={ward_entry['county']}"

    # Check county-level match (point is in the county but maybe a different constituency)
    for ward_entry in county_wards:
        if point_in_ward(lat, lng, ward_entry):
            detail = f"county_match_only:ward={ward_entry['ward']},subcounty={ward_entry['subcounty']},county={ward_entry['county']}"
            if exp_constituency and ward_entry["subcounty"] != exp_constituency:
                detail += f",expected_constituency={exp_constituency}"
            return True, detail

    # Point is NOT inside any ward polygon in this county
    return False, f"outside_county_boundary:{exp_county}"


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
    """Load reverse geocode cache from local JSON file (v9.4: canonical string keys)."""
    global _rev_geo_cache
    _rev_geo_cache = {}
    if not CACHE_FILE.exists():
        return
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        # keys are "lat|lng" string format (v9.4)
        for k, v in data.items():
            try:
                lat_s, lng_s = k.split("|")
                # Round to 6 decimals to ensure consistent tuple keys (v9.4)
                _rev_geo_cache[(round(float(lat_s), 6), round(float(lng_s), 6))] = v
            except:
                continue
        log.info(f"  Loaded {len(_rev_geo_cache)} entries from persistent cache")
    except Exception as e:
        log.warning(f"  Failed to load cache file: {e}")


def save_rev_geo_cache():
    """Save reverse geocode cache using atomic write (v9.4: tempfile + replace)."""
    if not _rev_geo_cache:
        return
    import tempfile
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        # Serialize keys as "lat|lng" with 6 decimal precision
        serializable = {f"{k[0]:.6f}|{k[1]:.6f}": v for k, v in _rev_geo_cache.items()}
        
        # Atomic write
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".tmp", dir=str(CACHE_FILE.parent))
        with os.fdopen(tmp_fd, 'w', encoding='utf-8') as f:
            json.dump(serializable, f, indent=2)
        
        # Replace existing file (atomic on Windows/Linux)
        Path(tmp_path).replace(CACHE_FILE)
    except Exception as e:
        log.warning(f"  Failed to save cache file: {e}")


# v11.0: Universal Result Archiver (E.V.E.R.Y.T.H.I.N.G Version)
def archive_full_record(table_name: str, record_id: int, payload: Dict, original_record: Optional[Dict] = None):
    """Real-time High-Fidelity Archiver. Captures 100% of telemetry to local JSON."""
    try:
        MASTER_ARCHIVE_FILE.parent.mkdir(parents=True, exist_ok=True)
        archive = {}
        if MASTER_ARCHIVE_FILE.exists():
            try:
                with open(MASTER_ARCHIVE_FILE, "r", encoding="utf-8") as f:
                    archive = json.load(f)
            except:
                archive = {}
        
        # Build comprehensive entry
        entry = {
            "archive_timestamp": datetime.now(timezone.utc).isoformat(),
            "table": table_name,
            "id": record_id,
        }
        
        # Include original context if provided
        if original_record:
            for k, v in original_record.items():
                if k not in ["latitude", "longitude", "geocode_status"]: # Don't overwrite new data with old
                    entry[f"original_{k}"] = v
        
        # Merge updated data
        entry.update(payload)
        
        # Key by table/id for stability
        archive_key = f"{table_name}:{record_id}"
        archive[archive_key] = entry
        
        # Atomic write
        import tempfile
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".tmp", dir=str(MASTER_ARCHIVE_FILE.parent))
        with os.fdopen(tmp_fd, 'w', encoding='utf-8') as f:
            json.dump(archive, f, indent=2)
        Path(tmp_path).replace(MASTER_ARCHIVE_FILE)
    except Exception as e:
        log.error(f"  âŒ Failed to update Master Archive: {e}")


def apply_resolution_sql(table_name: str, record_id: int, payload: Dict) -> bool:
    """v11.0: Direct SQL Writer. Bypasses API Egress Quotas using Transaction Pooler (Port 6543)."""
    db_url = get_secret("SUPABASE_DB_POOLED_URL")
    if not db_url:
        return False
        
    conn = None
    try:
        conn = psycopg2.connect(db_url)
        with conn.cursor() as cur:
            # Dynamically build UPDATE query
            columns = []
            values = []
            for k, v in payload.items():
                if k == "id": continue
                columns.append(f"{k} = %s")
                # Handle types
                if isinstance(v, (dict, list)):
                    values.append(json.dumps(v))
                else:
                    values.append(v)
            
            sql = f"UPDATE {table_name} SET {', '.join(columns)} WHERE id = %s"
            values.append(record_id)
            
            cur.execute(sql, tuple(values))
            conn.commit()
            return True
    except Exception as e:
        log.error(f"  âŒ Direct SQL Update Failed: {e}")
        return False
    finally:
        if conn:
            conn.close()


# â”€â”€ v10.2: Enhanced County Normalization (API Alignment) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
COUNTY_NORMALIZE = {
    'MOMBASA': 'MOMBASA', 'KWALE': 'KWALE', 'KILIFI': 'KILIFI',
    'TANA RIVER': 'TANA RIVER', 'TANARIVER': 'TANA RIVER', 'TANA-RIVER': 'TANA RIVER',
    'LAMU': 'LAMU', 'TAITA TAVETA': 'TAITA TAVETA', 'TAITA-TAVETA': 'TAITA TAVETA', 'TAITA/TAVETA': 'TAITA TAVETA',
    'GARISSA': 'GARISSA', 'WAJIR': 'WAJIR', 'MANDERA': 'MANDERA',
    'MARSABIT': 'MARSABIT', 'ISIOLO': 'ISIOLO', 'MERU': 'MERU',
    'THARAKA NITHI': 'THARAKA-NITHI', 'THARAKA-NITHI': 'THARAKA-NITHI', 'THARAKA NITHI ': 'THARAKA-NITHI',
    'THARAKA - NITHI': 'THARAKA-NITHI', 'THARAKA / NITHI': 'THARAKA-NITHI',
    'EMBU': 'EMBU', 'KITUI': 'KITUI', 'MACHAKOS': 'MACHAKOS', 'MAKUENI': 'MAKUENI',
    'NYANDARUA': 'NYANDARUA', 'NYERI': 'NYERI', 'KIRINYAGA': 'KIRINYAGA',
    'MURANG\'A': 'MURANG\'A', 'MURANGA': 'MURANG\'A', 'MURANG A': 'MURANG\'A',
    'KIAMBU': 'KIAMBU', 'TURKANA': 'TURKANA',
    'WEST POKOT': 'WEST POKOT', 'WESTPOKOT': 'WEST POKOT', 'WEST-POKOT': 'WEST POKOT',
    'SAMBURU': 'SAMBURU',
    'TRANS NZOIA': 'TRANS-NZOIA', 'TRANS-NZOIA': 'TRANS-NZOIA', 'TRANSNZOIA': 'TRANS-NZOIA',
    'UASIN GISHU': 'UASIN GISHU', 'UASINGISHU': 'UASIN GISHU', 'UASIN-GISHU': 'UASIN GISHU',
    'ELGEYO MARAKWET': 'ELGEYO-MARAKWET', 'ELGEYO-MARAKWET': 'ELGEYO-MARAKWET', 'ELGEYO/MARAKWET': 'ELGEYO-MARAKWET', 'KEIYO-MARAKWET': 'ELGEYO-MARAKWET',
    'ELEGEYO-MARAKWET': 'ELGEYO-MARAKWET',
    'NANDI': 'NANDI', 'BARINGO': 'BARINGO', 'LAIKIPIA': 'LAIKIPIA', 'NAKURU': 'NAKURU',
    'NAROK': 'NAROK', 'KAJIADO': 'KAJIADO', 'KERICHO': 'KERICHO', 'BOMET': 'BOMET',
    'KAKAMEGA': 'KAKAMEGA', 'VIHIGA': 'VIHIGA', 'BUNGOMA': 'BUNGOMA', 'BUSIA': 'BUSIA',
    'SIAYA': 'SIAYA', 'KISUMU': 'KISUMU',
    'HOMA BAY': 'HOMA BAY', 'HOMABAY': 'HOMA BAY', 'HOMA-BAY': 'HOMA BAY',
    'MIGORI': 'MIGORI', 'KISII': 'KISII', 'NYAMIRA': 'NYAMIRA',
    'NAIROBI': 'NAIROBI', 'NAIROBI CITY': 'NAIROBI'
}

def normalize_county(name: Optional[str]) -> str:
    """Normalize county name for comparison (uppercase, strip, handle Murang'a etc). Alignment with api/v1/offices.ts."""
    if not name: return ""
    n = name.strip().upper()
    n = n.replace("\u2019", "'").replace("\u2018", "'").replace("`", "'")
    
    # Try the comprehensive mapping first
    if n in COUNTY_NORMALIZE:
        return COUNTY_NORMALIZE[n]
    
    # Otherwise fallback to regex-based cleaning
    n = re.sub(r"\s+COUNTY\s*$", "", n)
    n = re.sub(r"\s*-\s*", "-", n)
    n = re.sub(r"\s+", " ", n)
    
    return SUBCOUNTY_TO_COUNTY.get(n, n)


def expected_county_for_constituency(constituency: str) -> Optional[str]:
    """Look up the expected county from the DB mapping."""
    key = constituency.strip().upper()
    return _constituency_county_map.get(key)


# â”€â”€ Direction Metadata Extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

    # Extract landmark name â€” text after "from", "to", "of", direction keywords
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


# â”€â”€ Contribution Data Lookup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


# â”€â”€ Reverse Geocoding for County Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def reverse_geocode_county(lat: float, lng: float) -> Optional[str]:
    """Reverse-geocode a coordinate via Nominatim to extract the county name, consult cache first (v9.4)."""
    cache_key = (round(lat, 6), round(lng, 6))
    if cache_key in _rev_geo_cache:
        return _rev_geo_cache[cache_key].get("county")

    # If not in cache, call address version which handles wait+cache
    res = reverse_geocode_address(lat, lng)
    return res.get("county")


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
    """v9.1: Reverse-geocode via Nominatim with Geoapify fallback (v10.6)."""
    cache_key = (round(lat, 6), round(lng, 6))
    if cache_key in _rev_geo_cache:
        return _rev_geo_cache[cache_key]

    # Try Nominatim first
    try:
        RATE_LIMITERS["nominatim"].wait()
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lng, "format": "json", "addressdetails": 1, "zoom": 6},
            headers={"User-Agent": USER_AGENT},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            address = data.get("address", {})
            county = address.get("county") or address.get("state_district") or address.get("state") or ""
            county = normalize_county(county)
            ward = address.get("suburb") or address.get("neighbourhood") or address.get("town") or address.get("village") or ""
            res = {"county": county, "ward": ward}
            _rev_geo_cache[cache_key] = res
            return res
    except Exception as e:
        log.warning(f"  Nominatim reverse geocode failed: {e}")

    # Fallback to Geoapify (v10.6)
    geoapify_key = get_secret("GEOAPIFY_API_KEY")
    if geoapify_key:
        try:
            RATE_LIMITERS["geoapify"].wait()
            resp = requests.get(
                "https://api.geoapify.com/v1/geocode/reverse",
                params={"lat": lat, "lon": lng, "apiKey": geoapify_key, "format": "json"},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                result = data.get("results", [{}])[0]
                county = result.get("state") or result.get("county") or ""
                county = normalize_county(county)
                ward = result.get("suburb") or result.get("neighbourhood") or result.get("city") or ""
                res = {"county": county, "ward": ward}
                _rev_geo_cache[cache_key] = res
                return res
        except Exception as e:
            log.warning(f"  Geoapify reverse geocode fallback failed: {e}")

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


# â”€â”€ Individual Geocoders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def geocode_nominatim(query: str, limit: int = 5) -> List[Dict]:
    """OSM Nominatim â€” free, 1 req/s, countrycodes=ke. Returns multiple results."""
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


def geocode_earth(query: str, continent: Optional[str] = None) -> List[Dict]:
    """v10.3: geocode.earth (Pelias-based) â€” global high-precision geocoder."""
    api_key = get_secret("GEOCODE_EARTH_API_KEY")
    if not api_key:
        return []
    try:
        RATE_LIMITERS["geocode_earth"].wait()
        params = {
            "text": query,
            "api_key": api_key,
            "size": "5",
        }
        # If continent is provided (diaspora), we don't restrict to KEN
        if not continent:
            params["boundary.country"] = "KEN"

        resp = requests.get("https://api.geocode.earth/v1/search", params=params, timeout=10)
        if resp.status_code != 200:
            return []
        
        data = resp.json()
        results = []
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            lat = feature["geometry"]["coordinates"][1]
            lng = feature["geometry"]["coordinates"][0]
            
            results.append({
                "lat": lat, "lng": lng, 
                "source": "geocode_earth", 
                "confidence": props.get("confidence", 0.5),
                "display_name": props.get("label", query),
                "county_from_api": props.get("region", "") or props.get("county", ""),
                "country_from_api": props.get("country", ""),
            })
        return results
    except Exception as e:
        log.warning(f"  Geocode.earth failed: {e}")
        return []


def geocode_geonames(query: str, country: str = "KE") -> List[Dict]:
    """GeoNames Search â€” reliable open-source data (v10.3)."""
    username = get_secret("GEONAMES_USERNAME")
    if not username:
        return []
    try:
        RATE_LIMITERS["geonames"].wait()
        params = {
            "q": query,
            "country": country,
            "maxRows": "3",
            "username": username,
            "type": "json"
        }
        resp = requests.get("http://api.geonames.org/searchJSON", params=params, timeout=10)
        if resp.status_code != 200:
            return []
        data = resp.json()
        results = []
        for g in data.get("geonames", []):
            lat, lng = float(g["lat"]), float(g["lng"])
            if country == "KE" and not is_in_kenya(lat, lng):
                continue
            results.append({
                "lat": lat, "lng": lng, "source": "geonames",
                "confidence": 0.65,
                "display_name": f"{g.get('name')}, {g.get('adminName1')}, {g.get('countryName')}",
                "county_from_api": g.get("adminName1", ""),
            })
        return results
    except Exception as e:
        log.warning(f"  GeoNames failed: {e}")
        return []


def geocode_geokeo(query: str) -> List[Dict]:
    """Geokeo â€” 2500/day, api key in env. Returns multiple results (v9.5 safe parse)."""
    api_key = get_secret("GEOKEO_API_KEY")
    if not api_key:
        return []
    try:
        RATE_LIMITERS["geokeo"].wait()
        resp = requests.get(
            "https://geokeo.com/geocode/v1/search.php",
            params={"q": query, "api": api_key},
            timeout=10,
        )
        if resp.status_code != 200 or "application/json" not in resp.headers.get("Content-Type", ""):
            return []
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


def geocode_locationiq(query: str) -> List[Dict]:
    """LocationIQ â€” 5,000/day free tier. OSM-backed (v9.5)."""
    api_key = get_secret("LOCATIONIQ_API_KEY")
    if not api_key:
        return []
    try:
        RATE_LIMITERS["locationiq"].wait()
        resp = safe_request(
            "https://us1.locationiq.com/v1/search",
            params={"key": api_key, "q": query, "format": "json", "countrycodes": "ke", "limit": 3},
        )
        if not resp:
            return []
        data = resp.json()
        results = []
        for r in data:
            lat, lng = float(r["lat"]), float(r["lon"])
            if not is_in_kenya(lat, lng):
                continue
            results.append({
                "lat": lat, "lng": lng, "source": "locationiq",
                "confidence": min(float(r.get("importance", 0.5)) * 1.5, 1.0),
                "display_name": r.get("display_name", ""),
                "county_from_api": "",
            })
        return results
    except Exception as e:
        log.warning(f"  LocationIQ failed: {e}")
        return []


def geocode_geoapify(query: str) -> List[Dict]:
    """Geoapify â€” high-quality global geocoding (v9.5)."""
    api_key = get_secret("GEOAPIFY_API_KEY")
    if not api_key:
        return []
    try:
        RATE_LIMITERS["geoapify"].wait()
        resp = safe_request(
            "https://api.geoapify.com/v1/geocode/search",
            params={"text": query, "apiKey": api_key, "filter": "countrycode:ke", "limit": 3},
        )
        if not resp:
            return []
        data = resp.json()
        results = []
        for f in data.get("features", []):
            lat = f["geometry"]["coordinates"][1]
            lng = f["geometry"]["coordinates"][0]
            if not is_in_kenya(lat, lng):
                continue
            props = f.get("properties", {})
            results.append({
                "lat": lat, "lng": lng, "source": "geoapify",
                "confidence": props.get("rank", {}).get("confidence", 0.5),
                "display_name": props.get("formatted", ""),
                "county_from_api": props.get("state", ""),
            })
        return results
    except Exception as e:
        log.warning(f"  Geoapify failed: {e}")
        return []


def geocode_opencage(query: str) -> List[Dict]:
    """OpenCage â€” 2,500/day free tier. Late-stage fallback (v9.5)."""
    api_key = get_secret("OPENCAGE_API_KEY")
    if not api_key:
        return []
    try:
        RATE_LIMITERS["opencage"].wait()
        resp = safe_request(
            "https://api.opencagedata.com/geocode/v1/json",
            params={"q": query, "key": api_key, "countrycode": "ke", "limit": 3, "no_annotations": 1},
        )
        if not resp:
            return []
        data = resp.json()
        results = []
        for r in data.get("results", []):
            lat, lng = r["geometry"]["lat"], r["geometry"]["lng"]
            if not is_in_kenya(lat, lng):
                continue
            results.append({
                "lat": lat, "lng": lng, "source": "opencage",
                "confidence": r.get("confidence", 5) / 10,
                "display_name": r.get("formatted", ""),
                "county_from_api": r.get("components", {}).get("state", ""),
            })
        return results
    except Exception as e:
        log.warning(f"  OpenCage failed: {e}")
        return []


# v9.1: ArcGIS Geocoder with key rotation
def geocode_arcgis(query: str, key_idx: int = 1) -> List[Dict]:
    """ArcGIS World Geocoding â€” enterprise-grade, key rotation support."""
    key1 = get_secret("ARCGIS_API_KEY_PRIMARY")
    key2 = get_secret("ARCGIS_API_KEY_SECONDARY")
    key = key1 if key_idx == 1 else key2
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
            if key_idx == 1 and key2:
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
    """Photon (Komoot) â€” OpenStreetMap-backed, no rate limit, bbox=Kenya."""
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
    """Gemini 2.0 Flash as a deep geocoding analyst (v10.8)."""
    api_key = get_secret("GEMINI_API_KEY")
    if not api_key: return []
    try:
        RATE_LIMITERS["gemini"].wait()
        context_parts = [f"the {constituency} IEBC constituency office in {county} County, Kenya"]
        if office_location: context_parts.append(f"located at or near {office_location}")
        if landmark: context_parts.append(f"landmark reference: {landmark}")

        prompt = (
            f"What are the GPS coordinates of {', '.join(context_parts)}?\n\n"
            f"Return ONLY a valid JSON object: {{\"lat\": <number>, \"lng\": <number>, \"county\": \"<county name>\"}}\n"
            f"If uncertain, return: {{\"lat\": null, \"lng\": null, \"county\": null}}"
        )
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}",
            json={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.0, "maxOutputTokens": 150}},
            timeout=15
        )
        resp.raise_for_status()
        text = resp.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        m = re.search(r'\{[^}]+\}', text)
        if not m: return []
        parsed = json.loads(m.group(0))
        lat, lng = parsed.get("lat"), parsed.get("lng")
        if lat is None or lng is None or not is_in_kenya(lat, lng): return []
        return [{
            "lat": lat, "lng": lng, "source": "gemini_ai", "confidence": 0.7,
            "display_name": f"{constituency} (Gemini)",
            "county_from_api": parsed.get("county", "") or ""
        }]
    except: return []

def geocode_openai(query: str) -> List[Dict]:
    """OpenAI GPT-4o-mini high-precision fallback."""
    api_key = get_secret("OPENAI_API_KEY")
    if not api_key: return []
    try:
        RATE_LIMITERS["openai"].wait()
        prompt = (
            f"What are the GPS coordinates of the IEBC office for: '{query}' in Kenya?\n"
            f"Return ONLY a JSON object: {{\"lat\": <number>, \"lng\": <number>, \"county\": \"<county name>\"}}"
        )
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.0,
                "response_format": {"type": "json_object"}
            },
            timeout=15
        )
        parsed = json.loads(resp.json()["choices"][0]["message"]["content"])
        lat, lng = parsed.get("lat"), parsed.get("lng")
        if lat is None or lng is None or not is_in_kenya(lat, lng): return []
        return [{
            "lat": lat, "lng": lng, "source": "openai_gpt4", "confidence": 0.75,
            "display_name": f"{query} (OpenAI)",
            "county_from_api": parsed.get("county", "") or ""
        }]
    except: return []

def geocode_manus(query: str) -> List[Dict]:
    """Manus AI (v10.7) high-precision provider."""
    api_key = get_secret("MANUS_API_KEY")
    if not api_key: return []
    try:
        RATE_LIMITERS["manus"].wait()
        prompt = f"GPS for IEBC office '{query}' in Kenya. JSON: {{\"lat\": <f>, \"lng\": <f>, \"county\": \"<s>\"}}"
        resp = requests.post(
            "https://api.manus.im/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"model": "manus-1", "messages": [{"role": "user", "content": prompt}], "temperature": 0.1},
            timeout=15
        )
        m = re.search(r'\{[^}]+\}', resp.json()["choices"][0]["message"]["content"])
        if not m: return []
        parsed = json.loads(m.group(0))
        lat, lng = parsed.get("lat"), parsed.get("lng")
        if lat is None or lng is None or not is_in_kenya(lat, lng): return []
        return [{
            "lat": lat, "lng": lng, "source": "manus_ai", "confidence": 0.7,
            "display_name": f"{query} (Manus)",
            "county_from_api": parsed.get("county", "") or ""
        }]
    except: return []

def geocode_groq(query: str) -> List[Dict]:
    """Groq Llama-3.3-70b (v10.8) with schema-in-prompt."""
    api_key = get_secret("GROQ_API_KEY")
    if not api_key: return []
    try:
        RATE_LIMITERS["groq"].wait()
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [
                {"role": "system", "content": "Return ONLY valid JSON: {\"lat\": number, \"lng\": number, \"county\": \"string\"}"},
                {"role": "user", "content": f"GPS for IEBC office '{query}' in Kenya."}
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"}
        }
        resp = requests.post("https://api.groq.com/openai/v1/chat/completions", headers={"Authorization": f"Bearer {api_key}"}, json=payload, timeout=15)
        parsed = json.loads(resp.json()["choices"][0]["message"]["content"])
        lat, lng = parsed.get("lat"), parsed.get("lng")
        if lat is None or lng is None or not is_in_kenya(lat, lng): return []
        return [{
            "lat": lat, "lng": lng, "source": "groq_ai", "confidence": 0.7,
            "display_name": f"{query} (Groq)",
            "county_from_api": parsed.get("county", "") or ""
        }]
    except: return []

def geocode_deepseek(query: str) -> List[Dict]:
    """DeepSeek AI Geocoding (v10.9)."""
    api_key = get_secret("DEEPSEEK_API_KEY")
    if not api_key: return []
    try:
        RATE_LIMITERS["deepseek"].wait()
        payload = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": f"GPS for IEBC office '{query}' in Kenya. JSON: {{\"lat\": <f>, \"lng\": <f>, \"county\": \"<s>\"}}"}],
            "response_format": {"type": "json_object"}
        }
        resp = requests.post("https://api.deepseek.com/chat/completions", headers={"Authorization": f"Bearer {api_key}"}, json=payload, timeout=15)
        parsed = json.loads(resp.json()["choices"][0]["message"]["content"])
        lat, lng = float(parsed["lat"]), float(parsed["lng"])
        if not is_in_kenya(lat, lng): return []
        return [{"lat": lat, "lng": lng, "source": "deepseek", "confidence": 0.7, "display_name": f"{query} (DeepSeek)", "county_from_api": parsed.get("county", "")}]
    except: return []

def geocode_cerebras(query: str) -> List[Dict]:
    """Cerebras AI (v10.9)."""
    api_key = get_secret("CEREBRAS_API_KEY")
    if not api_key: return []
    try:
        RATE_LIMITERS["cerebras"].wait()
        payload = {
            "model": "llama3.1-70b",
            "messages": [{"role": "user", "content": f"GPS for IEBC office '{query}' in Kenya. Output JSON ONLY: {{\"lat\": <f>, \"lng\": <f>, \"county\": \"<s>\"}}"}],
        }
        resp = requests.post("https://api.cerebras.ai/v1/chat/completions", headers={"Authorization": f"Bearer {api_key}"}, json=payload, timeout=15)
        m = re.search(r'\{[^}]+\}', resp.json()["choices"][0]["message"]["content"])
        if not m: return []
        parsed = json.loads(m.group(0))
        lat, lng = float(parsed["lat"]), float(parsed["lng"])
        if not is_in_kenya(lat, lng): return []
        return [{"lat": lat, "lng": lng, "source": "cerebras", "confidence": 0.7, "display_name": f"{query} (Cerebras)", "county_from_api": parsed.get("county", "")}]
    except: return []

def geocode_cohere(query: str) -> List[Dict]:
    """Cohere Command (v10.9)."""
    api_key = get_secret("COHERE_API_KEY")
    if not api_key: return []
    try:
        RATE_LIMITERS["cohere"].wait()
        payload = {
            "message": f"GPS for IEBC office '{query}' in Kenya. Return JSON: {{\"lat\": <f>, \"lng\": <f>, \"county\": \"<s>\"}}",
            "model": "command-r-plus"
        }
        resp = requests.post("https://api.cohere.ai/v1/chat", headers={"Authorization": f"Bearer {api_key}"}, json=payload, timeout=15)
        m = re.search(r'\{[^}]+\}', resp.json()["text"])
        if not m: return []
        parsed = json.loads(m.group(0))
        lat, lng = float(parsed["lat"]), float(parsed["lng"])
        if not is_in_kenya(lat, lng): return []
        return [{"lat": lat, "lng": lng, "source": "cohere", "confidence": 0.7, "display_name": f"{query} (Cohere)", "county_from_api": parsed.get("county", "")}]
    except: return []

def geocode_nvidia(query: str) -> List[Dict]:
    """NVIDIA NIM (v10.9)."""
    api_key = get_secret("NVIDIA_API_KEY")
    if not api_key: return []
    try:
        RATE_LIMITERS["nvidia"].wait()
        payload = {
            "model": "meta/llama-3.1-70b-instruct",
            "messages": [{"role": "user", "content": f"GPS for IEBC office '{query}' in Kenya. JSON: {{\"lat\": <f>, \"lng\": <f>, \"county\": \"<s>\"}}"}],
            "temperature": 0.1
        }
        resp = requests.post("https://integrate.api.nvidia.com/v1/chat/completions", headers={"Authorization": f"Bearer {api_key}"}, json=payload, timeout=15)
        parsed = json.loads(resp.json()["choices"][0]["message"]["content"])
        lat, lng = float(parsed["lat"]), float(parsed["lng"])
        if not is_in_kenya(lat, lng): return []
        return [{"lat": lat, "lng": lng, "source": "nvidia", "confidence": 0.7, "display_name": f"{query} (NVIDIA)", "county_from_api": parsed.get("county", "")}]
    except: return []

def geocode_openrouter(query: str) -> List[Dict]:
    """Open Router (v10.9)."""
    api_key = get_secret("OPENROUTER_API_KEY")
    if not api_key: return []
    try:
        RATE_LIMITERS["openrouter"].wait()
        payload = {
            "model": "meta-llama/llama-3.1-70b-instruct:free",
            "messages": [{"role": "user", "content": f"GPS coordinates for '{query}' in Kenya. JSON: {{\"lat\": <f>, \"lng\": <f>, \"county\": \"<s>\"}}"}],
        }
        resp = requests.post("https://openrouter.ai/api/v1/chat/completions", headers={"Authorization": f"Bearer {api_key}"}, json=payload, timeout=15)
        parsed = json.loads(resp.json()["choices"][0]["message"]["content"])
        lat, lng = float(parsed["lat"]), float(parsed["lng"])
        if not is_in_kenya(lat, lng): return []
        return [{"lat": lat, "lng": lng, "source": "openrouter", "confidence": 0.65, "display_name": f"{query} (OpenRouter)", "county_from_api": parsed.get("county", "")}]
    except: return []

def geocode_positionstack(query: str) -> List[Dict]:
    """PositionStack (v10.9)."""
    api_key = get_secret("POSITIONSTACK_API_KEY")
    if not api_key: return []
    try:
        RATE_LIMITERS["positionstack"].wait()
        resp = requests.get("http://api.positionstack.com/v1/forward", params={"access_key": api_key, "query": query, "country": "KE", "limit": 1}, timeout=10)
        r = resp.json().get("data", [])[0]
        return [{"lat": r["latitude"], "lng": r["longitude"], "source": "positionstack", "confidence": 0.6, "display_name": r.get("label", ""), "county_from_api": r.get("region", "")}]
    except: return []

def geocode_geocodemaps(query: str) -> List[Dict]:
    """Geocode.maps.co (v10.9)."""
    api_key = get_secret("GEOCODE_MAPS_API_KEY")
    if not api_key: return []
    try:
        RATE_LIMITERS["geocodemaps"].wait()
        resp = requests.get("https://geocode.maps.co/search", params={"q": query, "api_key": api_key}, timeout=10)
        r = resp.json()[0]
        return [{"lat": float(r["lat"]), "lng": float(r["lon"]), "source": "geocodemaps", "confidence": 0.6, "display_name": r.get("display_name", "")}]
    except: return []

def geocode_bigdatacloud(query: str) -> List[Dict]:
    """Big Data Cloud (v10.9)."""
    api_key = get_secret("BIGDATACLOUD_API_KEY")
    if not api_key: return []
    try:
        RATE_LIMITERS["bigdatacloud"].wait()
        resp = requests.get("https://api.bigdatacloud.net/data/address-lookup", params={"address": query, "key": api_key}, timeout=10)
        r = resp.json()
        return [{"lat": r["latitude"], "lng": r["longitude"], "source": "bigdatacloud", "confidence": 0.65, "display_name": r.get("label", "")}]
    except: return []

def geocode_overpass(query: str) -> List[Dict]:
    """Overpass API â€” Spatial lookup (v10.9)."""
    try:
        RATE_LIMITERS["overpass"].wait()
        overpass_query = f"[out:json][timeout:25];node[\"name\"~\"{query}\",i](-5.0,33.9,5.0,42.0);out body;"
        resp = requests.get("https://overpass-api.de/api/interpreter", params={"data": overpass_query}, timeout=30)
        elements = resp.json().get("elements", [])
        return [{"lat": e["lat"], "lng": e["lon"], "source": "overpass_osm", "confidence": 0.85, "display_name": e.get("tags", {}).get("name", query)} for e in elements]
    except: return []

def geocode_huggingface(query: str) -> List[Dict]:
    """HF Inference API (v9.5)."""
    api_key = get_secret("HF_API_TOKEN")
    if not api_key: return []
    try:
        RATE_LIMITERS["hf"].wait()
        api_url = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2"
        resp = requests.post(api_url, headers={"Authorization": f"Bearer {api_key}"}, json={"inputs": f"GPS for {query} in Kenya. JSON: {{\"lat\": ..., \"lng\": ...}}", "parameters": {"max_new_tokens": 100}}, timeout=15)
        text = resp.json()[0]["generated_text"]
        m = re.search(r'\{[^}]+\}', text)
        if not m: return []
        parsed = json.loads(m.group(0))
        lat, lng = float(parsed["lat"]), float(parsed["lng"])
        if not is_in_kenya(lat, lng): return []
        return [{"lat": lat, "lng": lng, "source": "hf_ai", "confidence": 0.6, "display_name": f"{query} (HF)"}]
    except: return []


# â”€â”€ Multi-Query Strategy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def build_queries(office: Dict) -> List[str]:
    """Build geocoding queries prioritizing PDF-sourced data over generic queries."""
    constituency = office.get("constituency_name") or office.get("constituency", "")
    county = office.get("county", "")
    location = office.get("office_location", "")
    landmark = office.get("landmark", "")

    queries = []
    # v10.7: PDF-sourced data queries FIRST â€” these are the most specific
    # Query 1: Office location + landmark + constituency + county (most specific)
    if location and landmark:
        queries.append(f"{location} near {landmark}, {constituency}, {county} County, Kenya")
    # Query 2: Office location + constituency + county
    if location:
        queries.append(f"{location}, {constituency}, {county} County, Kenya")
    # Query 3: Landmark + constituency + county
    if landmark:
        queries.append(f"{landmark}, {constituency}, {county} County, Kenya")
    # Query 4: Town/area only (from office_location) + county
    if location:
        town = re.sub(r'\b(Town|Centre|Center|CBD)\b', '', location, flags=re.IGNORECASE).strip()
        if town and town.upper() != constituency.upper():
            queries.append(f"{town}, {county} County, Kenya")
    # Query 5: Generic constituency + county (LAST â€” least specific, most likely to be wrong)
    queries.append(f"{constituency} IEBC office {county} county Kenya")

    # Ensure at least 3 queries
    if len(queries) < 3:
        queries.append(f"{constituency} constituency, {county}, Kenya")

    return queries


# â”€â”€ Multi-Source Resolver with Cross-Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def resolve_office_crossvalidated(office: Dict, expected_county: Optional[str]) -> Dict:
    """
    Run all geocoders (v9.5: including LocationIQ, Geoapify, OpenCage, Groq, HF)
    with multiple queries, then cross-validate each result against the expected county.
    """
    # v9.3: Reduce queries for offices with existing coordinates
    current_lat = office.get("latitude")
    queries = build_queries(office)
    if current_lat is not None and len(queries) > 3:
        log.info(f"  âš¡ Office has coordinates -> reducing queries to 3 stages")
        queries = queries[:3]

    constituency = office.get("constituency_name") or office.get("constituency", "")
    county = office.get("county", "")
    location = office.get("office_location", "")
    landmark = office.get("landmark", "")

    all_candidates: List[Dict] = []
    rejected: List[Dict] = []
    queries_used: List[str] = []

    for qi, query in enumerate(queries):
        log.info(f"  ðŸ” Query {qi + 1}/{len(queries)}: '{query}'")
        queries_used.append(query)

        # 1. Primary Free Sources (Unlimited/High Quota)
        # Nominatim
        nom_results = geocode_nominatim(query, limit=5)
        # LocationIQ (v9.5)
        liq_results = geocode_locationiq(query)
        # Geoapify (v9.5)
        gaf_results = geocode_geoapify(query)
        
        # 2. Secondary Reliable Sources
        # ArcGIS
        arc_results = geocode_arcgis(query)
        # Geokeo
        gko_results = geocode_geokeo(query)
        # Photon
        pho_results = geocode_photon(query)
        # geocode.earth (v10.2: REPLACED geocode.xyz)
        xyz_results = geocode_earth(query)
        # GeoNames (v10.3)
        gn_results = geocode_geonames(query)

        # Combine candidates for this query
        query_candidates = nom_results + liq_results + gaf_results + arc_results + gko_results + pho_results + xyz_results + gn_results

        # v9.5 Late-stage fallback for OpenCage (only if no results yet)
        if not query_candidates:
            query_candidates += geocode_opencage(query)

        # v9.1 structural compliance: Restore query_index tracking
        for r in query_candidates:
            r["query_used"] = query
            r["query_index"] = qi

        # v9.1 structural compliance: Restore manual validation loop
        for c in query_candidates:
            if not expected_county:
                all_candidates.append(c)
            else:
                api_county = normalize_county(c.get("county_from_api", "") or "")
                exp_county = normalize_county(expected_county or "")
                # County check + constituency check (precision v9.1)
                if api_county and (api_county == exp_county or exp_county in api_county or api_county in exp_county):
                    all_candidates.append(c)
                else:
                    c["rejection_reason"] = f"County mismatch: got {api_county}, expected {exp_county}"
                    rejected.append(c)

        # Short-circuit logic: if we found 2+ validated candidates, skip AI to save credits
        valid_count = len([c for c in all_candidates if not c.get("rejection_reason")])
        if valid_count >= 2:
            log.info(f"  âœ¨ Sufficient validated candidates ({valid_count}) found via standard sources. Skipping AI.")
            break

    # AI Escalation Layer (v10: AI results now go through county validation)
    valid_count = len([c for c in all_candidates if not c.get("rejection_reason")])
    if valid_count < 2:
        log.info(f"  \U0001f9e0 AI ESCALATION: Only {valid_count} validated candidates. Triggering Intelligence Layer.")
        ai_raw_results: List[Dict] = []

        # Gemini (Primary AI)
        gem_results = geocode_gemini(constituency, county, location, landmark)
        for r in gem_results:
            r["query_used"] = "gemini_ai_v10"
            r["query_index"] = -1
        ai_raw_results.extend(gem_results)

        # Groq (Secondary AI)
        if len(ai_raw_results) < 2:
            log.info("  \U0001f9e0 Triggering Groq (Llama-3)...")
            grq_results = geocode_groq(queries[0])
            for r in grq_results:
                r["query_used"] = "groq_ai_v10"
                r["query_index"] = -2
            ai_raw_results.extend(grq_results)

        # Hugging Face (Tertiary AI)
        if len(ai_raw_results) < 2:
            log.info("  \U0001f9e0 Triggering Hugging Face...")
            hf_results = geocode_huggingface(queries[0])
            for r in hf_results:
                r["query_used"] = "hf_ai_v10"
                r["query_index"] = -3
            ai_raw_results.extend(hf_results)

        # OpenAI (Premium Fallback)
        if len(ai_raw_results) < 2:
            log.info("  \U0001f9e0 Triggering OpenAI fallback...")
            oai_results = geocode_openai(queries[0])
            for r in oai_results:
                r["query_used"] = "openai_gpt4_v10"
                r["query_index"] = -4
            ai_raw_results.extend(oai_results)

        # Manus AI (v10.7)
        if len(ai_raw_results) < 2:
            log.info("  \U0001f9e0 Triggering Manus AI...")
            manus_results = geocode_manus(queries[0])
            for r in manus_results:
                r["query_used"] = "manus_ai_v10.7"
                r["query_index"] = -5
            ai_raw_results.extend(manus_results)

        # v10 FIX: Route AI results through the SAME county validation as standard geocoders
        for c in ai_raw_results:
            if not expected_county:
                all_candidates.append(c)
            else:
                api_county = normalize_county(c.get("county_from_api", "") or "")
                exp_county = normalize_county(expected_county or "")
                if api_county and (api_county == exp_county or exp_county in api_county or api_county in exp_county):
                    c["validation_method"] = "ai_county_match"
                    all_candidates.append(c)
                    log.info(f"    âœ“ AI [{c['source']}] county match: {api_county} == {exp_county}")
                else:
                    # AI gave no county or wrong county â€” try reverse geocode validation
                    rev_county = reverse_geocode_county(c["lat"], c["lng"])
                    if rev_county:
                        rev_norm = normalize_county(rev_county)
                        if rev_norm == exp_county or exp_county in rev_norm or rev_norm in exp_county:
                            c["validation_method"] = "ai_reverse_geocode_match"
                            all_candidates.append(c)
                            log.info(f"    âœ“ AI [{c['source']}] reverse-geocode county match: {rev_norm}")
                            continue
                    c["rejection_reason"] = f"AI county mismatch: got '{api_county or 'none'}', reverse='{rev_county or 'none'}', expected '{exp_county}'"
                    rejected.append(c)
                    log.info(f"    âœ— AI [{c['source']}] REJECTED: {c['rejection_reason']}")

    # v10.7: Stage 7 â€” PDF Extraction (ALWAYS runs, uses ALL geocoders)
    if _pdf_extraction_data:
        pdf_row = next((r for r in _pdf_extraction_data
                        if r.get("constituency_name", "").strip().upper() == constituency.strip().upper()), None)
        if pdf_row:
            pdf_loc = pdf_row.get("office_location", "")
            pdf_lnd = pdf_row.get("landmark", "")
            pq = f"{pdf_loc}, {pdf_lnd}, {constituency}, {county} County, Kenya"
            log.info(f"  \U0001f50d Stage 7 PDF: '{pq}'")
            queries_used.append(pq)
            # v10.9: Run PDF query through ALL 22 available geocoders for maximum coverage
            pdf_geocoders = [
                lambda q: geocode_nominatim(q, limit=3),
                geocode_arcgis, geocode_locationiq, geocode_geoapify, geocode_opencage,
                geocode_photon, geocode_earth, geocode_geonames, geocode_geokeo, 
                geocode_openai, geocode_manus, geocode_groq, geocode_huggingface,
                geocode_deepseek, geocode_cerebras, geocode_cohere, geocode_nvidia,
                geocode_openrouter, geocode_positionstack, geocode_geocodemaps,
                geocode_bigdatacloud, geocode_overpass,
                lambda q: geocode_gemini(constituency, county, office_location=q)
            ]
            for geocoder_fn in pdf_geocoders:
                try:
                    pdf_results = geocoder_fn(pq)
                    for r in pdf_results:
                        r["query_used"] = pq
                        r["query_index"] = 7  # Stage 7
                    all_candidates.extend(pdf_results)
                except Exception as e:
                    pass

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
                log.info(f"    âœ“ Contribution #{contrib['id']}: ({clat:.5f}, {clng:.5f}) "
                         f"conf={conf:.2f} confirmations={conf_count}")

    log.info(f"  ðŸ“Š Standard candidates: {len(all_candidates)}")

    # v10.9: Stage 6 â€” AI Escalation Layer (Trigger if low consensus)
    if len(all_candidates) < 2:
        log.info(f"  ðŸ§  AI ESCALATION: Triggering powerhouse providers...")
        # 1. Specialized Gemini Analysis
        all_candidates.extend(geocode_gemini(constituency, county, location, landmark))
        
        # 2. Sequential AI Fallbacks (using best query)
        best_q = queries[0] if queries else f"{constituency} IEBC office {county} Kenya"
        ai_powerhouse = [
            geocode_openai, geocode_manus, geocode_groq, geocode_deepseek,
            geocode_cerebras, geocode_cohere, geocode_nvidia, geocode_openrouter,
            geocode_huggingface
        ]
        for ai_fn in ai_powerhouse:
            try:
                results = ai_fn(best_q)
                for r in results:
                    r["query_used"] = f"ai_escalation_{ai_fn.__name__}"
                    r["query_index"] = -1
                all_candidates.extend(results)
            except: pass

    if not all_candidates:
        return {"best_results": [], "all_candidates": [], "queries_used": queries_used, "rejected": []}

    # â”€â”€ Cross-validation: filter candidates against expected county â”€â”€
    validated: List[Dict] = []
    for c in all_candidates:
        if not expected_county:
            validated.append(c)
            continue

        # First check: does the API-returned county match?
        api_county = normalize_county(c.get("county_from_api", "") or "")
        exp_county = normalize_county(expected_county or "")
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

        # v9.1: Fourth check â€” Ward-level precision with cached reverse geocode
        if c["confidence"] >= 0.4:
            ok, reason = validate_coords_precision(
                c["lat"], c["lng"], expected_county or "",
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

        # Not validated â€” reject with reason
        c["rejection_reason"] = f"County mismatch: expected '{expected_county}', API returned '{c.get('county_from_api', 'unknown')}'"
        rejected.append(c)

    log.info(f"  âœ… Validated: {len(validated)} | âŒ Rejected: {len(rejected)}")

    return {
        "best_results": validated,
        "all_candidates": all_candidates,
        "queries_used": queries_used,
        "rejected": rejected,
    }


# â”€â”€ Consensus Engine â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def compute_consensus(results: List[Dict]) -> Optional[Dict]:
    """
    Cluster results within CONSENSUS_RADIUS_KM and pick the cluster with the
    highest cumulative confidence.

    Confidence formula:
      composite = (agreementRatio Ã— 0.6) + (avgSourceConfidence Ã— 0.4)
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


# â”€â”€ Cluster / Duplicate Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


# â”€â”€ Supabase Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def fetch_all_offices(skip_resolved: bool = False) -> List[Dict]:
    """Fetch ALL offices from Supabase with full pagination (v10.4)."""
    all_offices: List[Dict] = []
    page_size: int = 1000
    offset: int = 0

    select_cols = (
        "id,constituency,constituency_name,constituency_code,county,"
        "office_location,latitude,longitude,landmark,landmark_type,landmark_subtype,"
        "direction_type,direction_landmark,direction_distance,distance_from_landmark,"
        "geocode_queries,geocode_query,geocode_method,geocode_confidence,geocode_status,"
        "formatted_address,verified,verified_latitude,verified_longitude,"
        "clean_office_location,notes,source,submission_method,submission_source,"
        "accuracy_meters,verified_at,verified_by,confidence_score,"
        "image_url,contributor_image_url,created_from_contribution_id,"
        "linked_contribution_ids,importance_score,result_type,"
        "successful_geocode_query,total_queries_tried"
    )

    # Optional filter to skip already-resolved offices (v10.5: include NULL status)
    # PostgREST neq.resolved EXCLUDES NULL values â€” must use OR to include unprocessed records
    status_filter = "&or=(geocode_status.neq.resolved,geocode_status.is.null)" if skip_resolved else ""

    while True:
        range_header = f"{offset}-{offset + page_size - 1}"
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/iebc_offices"
            f"?select={select_cols}"
            f"&order=id"
            f"{status_filter}",
            headers={**HEADERS, "Range": range_header},
            timeout=30,
        )
        # Supabase returns 200 for full results, 206 for partial (paginated)
        if resp.status_code not in (200, 206):
            resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        all_offices.extend(batch)
        log.info(f"  Fetched {len(all_offices)} offices so far...")
        if len(batch) < page_size:
            break  # Last page
        offset += page_size

    log.info(f"  Total offices fetched: {len(all_offices)}")
    return all_offices


def apply_resolution(office: Dict, lat: float, lng: float, confidence: float,
                     direction_meta: Dict, queries_used: List[str],
                     successful_query: str, formatted_addr: str,
                     consensus: Optional[Dict]) -> bool:
    """v11.0: Dual-Channel High-Fidelity Writer. Captures local archive + bypasses cloud quotas."""
    try:
        office_id = office["id"]
        # Fix: Supabase confidence_score is integer (percentage)
        conf_int = int(float(confidence) * 100)
        
        payload = {
            "latitude": lat,
            "longitude": lng,
            "geocode_verified": True,
            "geocode_verified_at": datetime.now(timezone.utc).isoformat(),
            "multi_source_confidence": float(confidence),
            "geocode_method": "multi_source_crossvalidated",
            "geocode_confidence": float(confidence),
            "geocode_status": "resolved",
            "geocode_queries": json.dumps(queries_used) if queries_used else None,
            "geocode_query": successful_query or None,
            "successful_geocode_query": successful_query or None,
            "total_queries_tried": len(queries_used),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "confidence_score": conf_int
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

        # Result type
        if consensus:
            sources = consensus.get("sources", [])
            if "contribution" in sources:
                payload["result_type"] = "contribution_validated"
            elif len(sources) >= 3:
                payload["result_type"] = "multi_source_consensus"
            else:
                payload["result_type"] = "cross_validated"

        # v11.0: CHANNEL 1 â€” UNIVERSAL LOCAL ARCHIVE (GUARANTEED SAFETY)
        archive_full_record("iebc_offices", office_id, payload, office)

        # v11.0: CHANNEL 2 â€” DIRECT SQL BYPASS (NO API EGRESS)
        if apply_resolution_sql("iebc_offices", office_id, payload):
            log.info(f"  âš¡ Direct SQL Update Succeeded (Office {office_id})")
            return True

        # v11.0: CHANNEL 3 â€” LEGACY REST API (FALLBACK / QUOTA SENSITIVE)
        resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/iebc_offices?id=eq.{office_id}",
            headers=HEADERS,
            json=payload,
            timeout=10,
        )
        if resp.status_code in (200, 204):
            return True

        # v9.1: Fallback to core-only columns if payload is too large or schema constrained
        log.warning(f"  DB full-payload update failed ({resp.status_code}): {resp.text[:300]}")
        core_payload = {
            "latitude": lat,
            "longitude": lng,
            "geocode_verified": True,
            "confidence_score": conf_int,
            "multi_source_confidence": float(confidence),
            "geocode_method": "multi_source_crossvalidated",
            "geocode_confidence": float(confidence),
            "geocode_status": "resolved",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        
        # Try SQL first for core payload too
        if apply_resolution_sql("iebc_offices", office_id, core_payload):
            return True

        resp2 = requests.patch(
            f"{SUPABASE_URL}/rest/v1/iebc_offices?id=eq.{office_id}",
            headers=HEADERS,
            json=core_payload,
            timeout=10,
        )
        if resp2.status_code in (200, 204):
            log.info(f"  âœ… Core-only fallback succeeded for office {office_id}")
            return True
        log.error(f"  âŒ Core-only fallback also failed ({resp2.status_code}): {resp2.text[:300]}")
        return False
    except Exception as e:
        log.error(f"  âŒ Network error applying resolution for office {office_id}: {e}")
        return False


def log_audit(office: Dict, issue_type: str, new_lat: float, new_lng: float,
              consensus: Optional[Dict], applied: bool) -> Optional[str]:
    """v11.0: Dual-Channel Audit Logger. Bypasses quota-blocked REST API."""
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
    
    # 1. Local Archive
    archive_full_record("geocode_audit", f"audit_office_{office['id']}_{int(time.time())}", office, payload)

    # 2. Direct SQL Bypass
    db_url = get_secret("SUPABASE_DB_POOLED_URL")
    if db_url:
        try:
            with psycopg2.connect(db_url) as conn:
                with conn.cursor() as cur:
                    sql = """
                        INSERT INTO geocode_audit (
                            office_id, constituency, county, issue_type, old_latitude, old_longitude, 
                            new_latitude, new_longitude, consensus_confidence, agreement_count, spread_km, 
                            sources_used, source_results, resolution_method, applied
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id;
                    """
                    cur.execute(sql, (
                        payload["office_id"], payload["constituency"], payload["county"], payload["issue_type"],
                        payload["old_latitude"], payload["old_longitude"], payload["new_latitude"], payload["new_longitude"],
                        payload["consensus_confidence"], payload["agreement_count"], payload["spread_km"],
                        json.dumps(payload["sources_used"]), json.dumps(payload["source_results"]),
                        payload["resolution_method"], payload["applied"]
                    ))
                    audit_id = cur.fetchone()[0]
                    log.info(f"  âš¡ Audit Log Written (ID: {audit_id})")
                    return str(audit_id)
        except Exception as e:
            log.warning(f"  SQL Audit failed: {e}. Falling back to REST...")

    # 3. Legacy REST Fallback
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
        log.warning(f"  Audit log fully failed: {e}")
    return None


def deep_retry_geocode(office: Dict, expected_county: str, reason: str) -> Optional[Dict]:
    """v10.7: Exhaustive deep retry using ALL PDF data before HITL queuing.
    Builds hyper-specific queries from every available PDF field and runs them
    through ALL geocoders + ALL AI providers. Each result is validated against
    ward boundaries. Returns a validated consensus dict or None.
    """
    constituency = office.get("constituency_name") or office.get("constituency", "")
    county = office.get("county", "")
    location = office.get("office_location", "")
    landmark = office.get("landmark", "")
    ward = office.get("ward", "")

    log.info(f"  ðŸ” DEEP RETRY ({reason}): Building hyper-specific queries from PDF data")

    # Pull ALL matching PDF records for this constituency (there may be multiple ward-level entries)
    pdf_rows = []
    if _pdf_extraction_data:
        pdf_rows = [r for r in _pdf_extraction_data
                    if r.get("constituency_name", "").strip().upper() == constituency.strip().upper()]
    log.info(f"  ðŸ” Found {len(pdf_rows)} PDF records for constituency '{constituency}'")

    # Build hyper-specific queries from PDF data
    retry_queries = []

    # Tier 1: From the office record itself (most specific combinations)
    if location and landmark:
        retry_queries.append(f"{location} near {landmark}, {constituency}, {county} County, Kenya")
        retry_queries.append(f"{location}, {landmark}, {county} County, Kenya")
    if location:
        retry_queries.append(f"{location}, {constituency} constituency, {county} County, Kenya")
        retry_queries.append(f"{location}, {county} County, Kenya")
    if landmark:
        retry_queries.append(f"{landmark}, {constituency}, {county} County, Kenya")
        retry_queries.append(f"{landmark}, {county} County, Kenya")

    # Tier 2: From ALL PDF records for this constituency (ward-level data)
    for pdf_row in pdf_rows:
        pdf_loc = pdf_row.get("office_location", "").strip()
        pdf_lnd = pdf_row.get("landmark", "").strip()
        pdf_ward = pdf_row.get("ward", "").strip()
        if pdf_loc and pdf_loc.upper() != location.upper():
            if pdf_lnd:
                retry_queries.append(f"{pdf_loc} near {pdf_lnd}, {constituency}, {county} County, Kenya")
            retry_queries.append(f"{pdf_loc}, {constituency}, {county} County, Kenya")
        if pdf_ward:
            retry_queries.append(f"{pdf_ward} ward, {constituency}, {county} County, Kenya")
            if pdf_loc:
                retry_queries.append(f"{pdf_loc}, {pdf_ward}, {county} County, Kenya")

    # Tier 3: Direction-based queries from the office record
    dir_type = office.get("direction_type", "") or ""
    dir_landmark = office.get("direction_landmark", "") or ""
    dir_distance = office.get("distance_from_landmark", "") or ""
    if dir_landmark:
        retry_queries.append(f"{dir_landmark}, {constituency}, {county} County, Kenya")
        if dir_type and dir_distance:
            retry_queries.append(f"{dir_distance} {dir_type} of {dir_landmark}, {county} County, Kenya")

    # Tier 4: Ward name as location hint
    if ward:
        retry_queries.append(f"{ward} ward, {constituency} constituency, {county} County, Kenya")
        retry_queries.append(f"{ward}, {county} County, Kenya")

    # Deduplicate while preserving order
    seen = set()
    unique_queries = []
    for q in retry_queries:
        q_norm = q.strip().upper()
        if q_norm and q_norm not in seen:
            seen.add(q_norm)
            unique_queries.append(q)
    retry_queries = unique_queries[:12]  # Cap at 12 queries to avoid excessive API usage

    log.info(f"  ðŸ” Deep retry: {len(retry_queries)} unique queries")

    # All geocoders
    all_geocoders = [
        lambda q: geocode_nominatim(q, limit=5),
        geocode_arcgis,
        geocode_locationiq,
        geocode_geoapify,
        geocode_photon,
        geocode_earth,
        geocode_geonames,
        geocode_geokeo,
        geocode_opencage,
    ]

    all_retry_candidates: List[Dict] = []

    # Phase 1: Run all standard geocoders on all queries
    for qi, query in enumerate(retry_queries):
        log.info(f"  ðŸ” Retry query {qi+1}/{len(retry_queries)}: '{query}'")
        for geocoder_fn in all_geocoders:
            try:
                results = geocoder_fn(query)
                for r in results:
                    r["query_used"] = query
                    r["query_index"] = 100 + qi  # Mark as retry
                all_retry_candidates.extend(results)
            except Exception:
                pass

        # Short-circuit if we already have enough boundary-validated candidates
        validated_in_boundary = 0
        for c in all_retry_candidates:
            ok, _ = validate_point_in_boundary(c["lat"], c["lng"], expected_county, constituency)
            if ok and "no_boundary" not in _:
                validated_in_boundary += 1
        if validated_in_boundary >= 3:
            log.info(f"  ðŸ” Short-circuit: {validated_in_boundary} boundary-validated candidates found")
            break

    # Phase 2: AI providers (always try â€” they have contextual understanding)
    log.info(f"  ðŸ” Phase 2: AI providers")
    ai_query = f"{location}, {landmark}, {constituency} constituency, {county} County, Kenya".strip(", ")

    # Gemini (structured â€” most reliable for Kenya)
    gem_results = geocode_gemini(constituency, county, location, landmark)
    for r in gem_results:
        r["query_used"] = "deep_retry_gemini"
        r["query_index"] = 200
    all_retry_candidates.extend(gem_results)

    # Groq
    grq_results = geocode_groq(ai_query)
    for r in grq_results:
        r["query_used"] = "deep_retry_groq"
        r["query_index"] = 201
    all_retry_candidates.extend(grq_results)

    # OpenAI
    oai_results = geocode_openai(ai_query)
    for r in oai_results:
        r["query_used"] = "deep_retry_openai"
        r["query_index"] = 202
    all_retry_candidates.extend(oai_results)

    # HuggingFace
    hf_results = geocode_huggingface(ai_query)
    for r in hf_results:
        r["query_used"] = "deep_retry_hf"
        r["query_index"] = 203
    all_retry_candidates.extend(hf_results)

    # Manus AI (v10.7)
    manus_results = geocode_manus(ai_query)
    for r in manus_results:
        r["query_used"] = "deep_retry_manus"
        r["query_index"] = 204
    all_retry_candidates.extend(manus_results)

    log.info(f"  ðŸ” Total deep retry candidates: {len(all_retry_candidates)}")

    if not all_retry_candidates:
        log.warning(f"  ðŸ” Deep retry: NO candidates found at all")
        return None

    # Phase 3: Validate ALL candidates against ward boundaries
    boundary_validated: List[Dict] = []
    for c in all_retry_candidates:
        ok, detail = validate_point_in_boundary(c["lat"], c["lng"], expected_county, constituency)
        if ok and "no_boundary" not in detail:
            c["validation_method"] = f"deep_retry_boundary:{detail}"
            boundary_validated.append(c)
        elif ok and "no_boundary" in detail:
            # Fallback: try reverse geocode county check
            rev_county = reverse_geocode_county(c["lat"], c["lng"])
            if rev_county:
                rev_norm = normalize_county(rev_county)
                exp_norm = normalize_county(expected_county)
                if rev_norm == exp_norm or exp_norm in rev_norm or rev_norm in exp_norm:
                    c["validation_method"] = f"deep_retry_revgeo:{rev_county}"
                    boundary_validated.append(c)

    log.info(f"  ðŸ” Boundary-validated: {len(boundary_validated)} / {len(all_retry_candidates)}")

    if not boundary_validated:
        log.warning(f"  ðŸ” Deep retry: All {len(all_retry_candidates)} candidates FAILED boundary validation")
        return None

    # Phase 4: Compute consensus from boundary-validated candidates
    retry_consensus = compute_consensus(boundary_validated)
    if retry_consensus:
        # Final boundary check on the consensus itself
        final_ok, final_detail = validate_point_in_boundary(
            retry_consensus["lat"], retry_consensus["lng"], expected_county, constituency
        )
        if final_ok and "outside" not in final_detail:
            log.info(f"  âœ… DEEP RETRY SUCCESS: ({retry_consensus['lat']:.5f}, {retry_consensus['lng']:.5f}) "
                     f"conf={retry_consensus['confidence']:.2f} | {final_detail}")
            retry_consensus["method"] = "deep_retry_v10.7"
            retry_consensus["boundary_detail"] = final_detail
            return retry_consensus
        else:
            log.warning(f"  ðŸ” Deep retry consensus also failed boundary: {final_detail}")
            return None

    log.warning(f"  ðŸ” Deep retry: Could not reach consensus from boundary-validated candidates")
    return None


def enqueue_hitl(office: Dict, consensus: Optional[Dict], issue_type: str, audit_id: Optional[str]):
    """v11.0: Dual-Channel HITL Queue. Bypasses quota-blocked REST API."""
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
    
    # 1. Local Archive
    archive_full_record("hitl_queue", f"hitl_office_{office['id']}_{int(time.time())}", office, payload)

    # 2. Direct SQL Bypass
    db_url = get_secret("SUPABASE_DB_POOLED_URL")
    if db_url:
        try:
            with psycopg2.connect(db_url) as conn:
                with conn.cursor() as cur:
                    sql = """
                        INSERT INTO geocode_hitl_queue (
                            office_id, audit_id, issue_type, proposed_latitude, proposed_longitude, 
                            confidence, agreement_count, spread_km, source_details, status
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """
                    cur.execute(sql, (
                        payload["office_id"], payload["audit_id"], payload["issue_type"],
                        payload["proposed_latitude"], payload["proposed_longitude"],
                        payload["confidence"], payload["agreement_count"], payload["spread_km"],
                        json.dumps(payload["source_details"]), payload["status"]
                    ))
                    log.info(f"  âš¡ HITL Queue Written (Office {office['id']})")
                    return
        except Exception as e:
            log.warning(f"  SQL HITL failed: {e}. Falling back to REST...")

    # 3. Legacy REST Fallback
    try:
        requests.post(
            f"{SUPABASE_URL}/rest/v1/geocode_hitl_queue",
            headers=HEADERS,
            json=payload,
            timeout=10,
        )
    except Exception as e:
        log.warning(f"  HITL enqueue fully failed: {e}")


# â”€â”€ v10.0: Generic Geocoding Helpers (Parallel to Legacy) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def build_generic_queries(record: Dict, t_cfg: Dict) -> List[str]:
    """Generate search queries for any supported table configuration."""
    name = record.get(t_cfg["name"]) or ""
    context = record.get(t_cfg["context"]) or ""
    location = record.get(t_cfg["location"]) or ""
    landmark = record.get(t_cfg["landmark"]) or ""
    
    queries = []
    # Primary Template
    try:
        q1 = t_cfg["query_template"].format(location=location, name=name, context=context).strip(", ")
        queries.append(q1)
    except:
        queries.append(f"{name}, {location}, {context}")

    # Fallbacks
    if location: queries.append(f"{location}, {context}")
    if name:     queries.append(f"{name}, {context}")
    if landmark: queries.append(f"{landmark}, {context}")

    seen = set()
    unique_queries = []
    for q in queries:
        if q and q not in seen:
            unique_queries.append(q)
            seen.add(q)
    return unique_queries[:5]

def resolve_record_crossvalidated(record: Dict, expected_context: str, t_cfg: Dict) -> Dict:
    """Generic cross-validated resolver for Wards/Diaspora."""
    queries = build_generic_queries(record, t_cfg)
    all_candidates: List[Dict] = []
    rejected: List[Dict] = []
    queries_used: List[str] = []

    for qi, query in enumerate(queries):
        log.info(f"  ðŸ” Query {qi + 1}/{len(queries)}: '{query}'")
        queries_used.append(query)

        # Standard Sources
        results = (geocode_nominatim(query, limit=5) + geocode_locationiq(query) + 
                   geocode_geoapify(query) + geocode_arcgis(query) + 
                   geocode_geokeo(query) + geocode_photon(query) + 
                   geocode_earth(query, t_cfg.get("continent")) +
                   geocode_geonames(query, t_cfg.get("country_code", "KE")))
        
        for r in results:
            r["query_used"], r["query_index"] = query, qi
            
            # Validation
            api_context = normalize_county(r.get("county_from_api", ""))
            exp_context = normalize_county(expected_context)
            
            is_valid = False
            if t_cfg.get("validate_kenya"):
                if api_context and (api_context == exp_context or exp_context in api_context):
                    is_valid = True
            else:
                api_country = r.get("country_from_api", "").strip().upper()
                if api_country and (api_country == exp_context or exp_context in api_country):
                    is_valid = True
            
            if is_valid: 
                all_candidates.append(r)
            else:
                r["rejection_reason"] = f"Context mismatch: {api_context} vs {exp_context}"
                rejected.append(r)

        if len([c for c in all_candidates if not c.get("rejection_reason")]) >= 2:
            break

    # AI Escalation
    if len(all_candidates) < 2:
        log.info("  \U0001f9e0 AI ESCALATION...")
        ai_res = geocode_gemini(record.get(t_cfg["name"], ""), expected_context, 
                                record.get(t_cfg["location"], ""), record.get(t_cfg["landmark"], ""))
        all_candidates.extend(ai_res)

    return {"best_results": all_candidates, "queries_used": queries_used, "rejected": rejected}

def apply_resolution_generic(table: str, record_id: int, lat: float, lng: float, 
                             confidence: float, queries_used: List[str], formatted_addr: str, record: Dict) -> bool:
    """v11.0: Generic schema-aware field updater with Dual-Channel safety."""
    try:
        payload = {
            "latitude": lat, "longitude": lng,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        meta = {
            "geocode_method": "multi_source_v10",
            "geocode_confidence": float(confidence),
            "geocode_status": "verified" if confidence >= 0.8 else "resolved",
            "formatted_address": formatted_addr,
            "geocode_queries": json.dumps(queries_used)
        }
        for k, v in meta.items():
            if k in record: payload[k] = v
        if "confidence_score" in record: payload["confidence_score"] = int(float(confidence) * 100)

        # v11.0: CHANNEL 1 â€” LOCAL ARCHIVE
        archive_full_record(table, record_id, payload, record)

        # v11.0: CHANNEL 2 â€” DIRECT SQL BYPASS
        if apply_resolution_sql(table, record_id, payload):
            log.info(f"  âš¡ Direct SQL Update Succeeded ({table}:{record_id})")
            return True

        # v11.0: CHANNEL 3 â€” LEGACY REST API
        resp = requests.patch(f"{SUPABASE_URL}/rest/v1/{table}?id=eq.{record_id}", 
                              headers=HEADERS, json=payload, timeout=10)
        return resp.status_code in (200, 204)
    except Exception as e:
        log.error(f"  Update failed: {e}")
        return False


# â”€â”€ Fetch Flagged Offices (legacy path) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


def fetch_autoresolved_offices() -> List[Dict]:
    """Fetch offices from HITL queue that were auto_resolved or dismissed."""
    log.info("Fetching auto_resolved and dismissed offices from HITL queue...")
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/geocode_hitl_queue?status=in.(auto_resolved,dismissed)&select=office_id&limit=3000",
        headers=HEADERS,
        timeout=15,
    )
    resp.raise_for_status()
    items = resp.json()
    office_ids = set([item["office_id"] for item in items])
    if not office_ids:
        log.info("No auto_resolved or dismissed offices found.")
        return []

    ids_csv = ",".join(str(oid) for oid in office_ids)
    resp_offices = requests.get(
        f"{SUPABASE_URL}/rest/v1/iebc_offices?id=in.({ids_csv})"
        f"&select=id,constituency,constituency_name,constituency_code,county,"
        f"office_location,latitude,longitude,landmark,landmark_type,landmark_subtype,"
        f"direction_type,direction_landmark,direction_distance,distance_from_landmark,"
        f"geocode_queries,geocode_query,geocode_method,geocode_confidence,geocode_status,"
        f"formatted_address,verified,clean_office_location,notes,source",
        headers={**HEADERS},
        timeout=15,
    )
    resp_offices.raise_for_status()
    offices = resp_offices.json()
    log.info(f"Fetched {len(offices)} auto-resolved/dismissed offices from database")
    return offices


# â”€â”€ Main Pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def main():
    parser = argparse.ArgumentParser(description="Multi-Source Cross-Validated Resolver v10.4")
    parser.add_argument("--apply", action="store_true", help="Write resolved coords to Supabase")
    parser.add_argument("--all", action="store_true", help="Resolve ALL records")
    parser.add_argument("--office-id", type=int, help="Resolve a single office by ID")
    parser.add_argument("--id", type=int, help="Generic Record ID (if table is not iebc_offices)")
    parser.add_argument("--table", default="iebc_offices", choices=SUPPORTED_TABLES.keys(), help="Target table")
    parser.add_argument("--limit", type=int, default=50000, help="Max records to process")
    parser.add_argument("--offset", type=int, default=0, help="Skip first N records (resume support)")
    parser.add_argument("--skip-resolved", action="store_true", help="Skip offices with geocode_status=resolved")
    parser.add_argument("--hitl-autoresolved", action="store_true", help="Resolve HITL auto_resolved/dismissed")
    parser.add_argument("--json-output", action="store_true", help="Output JSON summary")
    parser.add_argument("--skip-clusters", action="store_true", help="Skip cluster detection phase")
    parser.add_argument("--task-id", help="Admin Task ID")
    args = parser.parse_args()

    # â”€â”€ Phase 0: Init â”€â”€
    T_CFG = SUPPORTED_TABLES[args.table]
    load_reference_data()
    
    admin_task = None
    if args.task_id and HAS_ADMIN_LIB:
        try:
            admin_task = AdminTask(args.task_id)
            admin_task.log(f"Starting {args.table} Resolver", level='step')
        except: pass

    # â”€â”€ BRANCHING EXECUTION â”€â”€
    
    if args.table == "iebc_offices":
        # â”€â”€ LEGACY IEBC OFFICE PATH (100% Preserved Logic) â”€â”€
        mode_label = "APPLY (LIVE)" if args.apply else "DRY RUN"
        log.info("=" * 70)
        log.info("MULTI-SOURCE CROSS-VALIDATED GEOCODING RESOLVER")
        log.info(f"Mode: {mode_label} | Table: {args.table}")
        log.info("=" * 70)

        # 1. Fetch
        if args.office_id:
            resp = requests.get(f"{SUPABASE_URL}/rest/v1/iebc_offices?id=eq.{args.office_id}&select={T_CFG['select']}", headers=HEADERS)
            offices = resp.json()
        elif args.all:
            log.info("Fetching ALL offices from database...")
            offices = fetch_all_offices(skip_resolved=args.skip_resolved)
        elif args.hitl_autoresolved:
            offices = fetch_autoresolved_offices()
        else:
            offices = fetch_flagged_offices()

        if not offices:
            log.info("No offices to resolve.")
            if admin_task: admin_task.complete("No offices required resolution.")
            return

        # 2. Phase 1: Cluster Detection
        if not args.skip_clusters and not args.office_id:
            log.info("\nPHASE 1: CLUSTER & DUPLICATE DETECTION")
            clusters = detect_clusters(offices)
            case_dupes = detect_case_duplicates(offices)
            if clusters:
                log.info(f"  Found {len(clusters)} coordinate clusters.")
                cid_set = set()
                for cl in clusters: cid_set.update(cl["member_ids"])
                offices = [o for o in offices if o["id"] in cid_set] + [o for o in offices if o["id"] not in cid_set]
            if case_dupes:
                log.info(f"  Found {len(case_dupes)} case-sensitivity duplicates.")

        # v10.4: Apply offset (resume support) and limit
        if args.offset > 0:
            log.info(f"  Skipping first {args.offset} offices (--offset)")
            offices = offices[args.offset:]
        offices = offices[:args.limit]
        log.info(f"\nPHASE 2: RESOLUTION ({len(offices)} offices)")
        stats = {
            "resolved": 0, "auto_applied": 0, "hitl_queued": 0,
            "no_consensus": 0, "no_validated_candidates": 0,
            "skipped_accurate": 0, "total": len(offices),
        }
        results_log = []

        for i, office in enumerate(offices, 1):
            name = office.get("constituency_name") or f"ID:{office['id']}"
            county = office.get("county", "Unknown")
            log.info(f"\n[{i}/{len(offices)}] {name} ({county})")
            
            expected_county = expected_county_for_constituency(name) or county
            dir_meta = extract_direction_metadata(office.get("office_location", ""), office.get("landmark", ""))
            
            # Run Stratified Matrix Resolver v11.1 (Primary)
            # Falls back to original crossvalidated logic if necessary
            resolution = resolve_matrix_iebc(office)
            validated = resolution["best_results"]
            queries_used = resolution["queries_used"]
            
            # v11.1: If Matrix flagged for HITL, we respect that status
            matrix_status = resolution.get("status", "failed")
            
            consensus = compute_consensus(validated) if validated else None
            
            if consensus:
                # Add status to consensus for tracking
                consensus["matrix_status"] = matrix_status
                log.info(f"  ✅ Consensus: ({consensus['lat']:.5f}, {consensus['lng']:.5f}) conf={consensus['confidence']:.2f}")
                
                # v10.7: MANDATORY boundary validation on FINAL consensus
                # Two-layer validation: (1) Ward polygon boundary check, (2) Reverse-geocode county fallback
                consensus_county_ok = True
                boundary_detail = ""
                if expected_county:
                    # Layer 1: Point-in-polygon ward boundary check (most accurate)
                    boundary_ok, boundary_detail = validate_point_in_boundary(
                        consensus["lat"], consensus["lng"],
                        expected_county,
                        office.get("constituency_name") or office.get("constituency", "")
                    )
                    if not boundary_ok:
                        log.warning(f"  ðŸš« BOUNDARY REJECTED: {boundary_detail}")
                        log.warning(f"     Coordinates ({consensus['lat']:.5f}, {consensus['lng']:.5f}) are OUTSIDE {expected_county} ward boundaries. Skipping write.")
                        consensus_county_ok = False
                    elif "no_boundary" in boundary_detail:
                        # Layer 2: Fallback to reverse-geocode county check
                        rev_county = reverse_geocode_county(consensus["lat"], consensus["lng"])
                        if rev_county:
                            rev_norm = normalize_county(rev_county)
                            exp_norm = normalize_county(expected_county)
                            if not (rev_norm == exp_norm or exp_norm in rev_norm or rev_norm in exp_norm):
                                log.warning(f"  🚫 CONSENSUS REJECTED: reverse-geocode county '{rev_county}' != expected '{expected_county}'")
                                log.warning(f"     Coordinates ({consensus['lat']:.5f}, {consensus['lng']:.5f}) are NOT in {expected_county}. Skipping write.")
                                consensus_county_ok = False
                        else:
                            log.warning(f"  ⚠️ Could not reverse-geocode consensus coordinates for county validation")
                    else:
                        log.info(f"  ✅ Boundary validated: {boundary_detail}")
                
                if not consensus_county_ok:
                    # v10.7: DEEP RETRY before HITL queuing
                    retry_result = deep_retry_geocode(office, expected_county, "BOUNDARY_MISMATCH")
                    if retry_result:
                        # Deep retry found valid coordinates — apply them
                        best_addr_retry = ""
                        for s in retry_result.get("source_details", []):
                            if s.get("display_name") and len(s["display_name"]) > len(best_addr_retry):
                                best_addr_retry = s["display_name"]
                        if args.apply:
                            ok = apply_resolution(office, retry_result["lat"], retry_result["lng"],
                                                  retry_result["confidence"], dir_meta, queries_used,
                                                  "", best_addr_retry, retry_result)
                            log_audit(office, "DEEP_RETRY_RESOLVED", retry_result["lat"], retry_result["lng"], retry_result, ok)
                            if ok: stats["auto_applied"] += 1
                        else:
                            stats["auto_applied"] += 1
                        stats["resolved"] += 1
                        continue
                    else:
                        # Deep retry also failed — now HITL queue
                        if args.apply:
                            audit_id = log_audit(office, "BOUNDARY_MISMATCH", consensus["lat"], consensus["lng"], consensus, False)
                            enqueue_hitl(office, consensus, "BOUNDARY_MISMATCH", audit_id)
                        stats["hitl_queued"] += 1
                        stats["resolved"] += 1
                        continue
                
                # Check displacement
                old_lat, old_lng = office.get("latitude"), office.get("longitude")
                if old_lat is not None and old_lng is not None:
                    displacement = haversine_km(old_lat, old_lng, consensus["lat"], consensus["lng"])
                    log.info(f"  📐 Displacement: {displacement:.1f} km")
                else:
                    displacement = 999
                
                issue_type = "NULL_COORDS" if (old_lat is None) else "DISPLACED"
                
                # Format Address
                best_addr = ""
                for s in consensus.get("source_details", []):
                    if s.get("display_name") and len(s["display_name"]) > len(best_addr):
                        best_addr = s["display_name"]

                if displacement <= DISPLACEMENT_THRESHOLD_KM:
                    log.info(f"  ⏭️  Coordinates accurate — updating metadata only")
                    if args.apply:
                        apply_resolution(office, old_lat, old_lng, consensus["confidence"], dir_meta, queries_used, "", best_addr, consensus)
                    stats["skipped_accurate"] += 1
                elif consensus["confidence"] >= AUTO_APPLY_THRESHOLD:
                    if args.apply:
                        ok = apply_resolution(office, consensus["lat"], consensus["lng"], consensus["confidence"], dir_meta, queries_used, "", best_addr, consensus)
                        log_audit(office, issue_type, consensus["lat"], consensus["lng"], consensus, ok)
                        if ok: stats["auto_applied"] += 1
                    else: stats["auto_applied"] += 1
                else:
                    # v10.7: DEEP RETRY before HITL queuing for low confidence
                    retry_result = deep_retry_geocode(office, expected_county, f"LOW_CONFIDENCE:{consensus['confidence']:.2f}")
                    if retry_result:
                        best_addr_retry = ""
                        for s in retry_result.get("source_details", []):
                            if s.get("display_name") and len(s["display_name"]) > len(best_addr_retry):
                                best_addr_retry = s["display_name"]
                        if args.apply:
                            ok = apply_resolution(office, retry_result["lat"], retry_result["lng"],
                                                  retry_result["confidence"], dir_meta, queries_used,
                                                  "", best_addr_retry, retry_result)
                            log_audit(office, "DEEP_RETRY_RESOLVED", retry_result["lat"], retry_result["lng"], retry_result, ok)
                            if ok: stats["auto_applied"] += 1
                        else:
                            stats["auto_applied"] += 1
                    else:
                        if args.apply:
                            audit_id = log_audit(office, issue_type, consensus["lat"], consensus["lng"], consensus, False)
                            enqueue_hitl(office, consensus, issue_type, audit_id)
                        stats["hitl_queued"] += 1
                
                stats["resolved"] += 1
            else:
                # No consensus at all — deep retry for zero-result records too
                retry_result = deep_retry_geocode(office, expected_county, "NO_CONSENSUS")
                if retry_result:
                    best_addr_retry = ""
                    for s in retry_result.get("source_details", []):
                        if s.get("display_name") and len(s["display_name"]) > len(best_addr_retry):
                            best_addr_retry = s["display_name"]
                    if args.apply:
                        ok = apply_resolution(office, retry_result["lat"], retry_result["lng"],
                                              retry_result["confidence"], dir_meta, queries_used,
                                              "", best_addr_retry, retry_result)
                        log_audit(office, "DEEP_RETRY_RESOLVED", retry_result["lat"], retry_result["lng"], retry_result, ok)
                        if ok: stats["auto_applied"] += 1
                    else:
                        stats["auto_applied"] += 1
                    stats["resolved"] += 1
                else:
                    log.warning("  âŒ No consensus even after deep retry.")
                    if args.apply:
                        enqueue_hitl(office, None, "EXHAUSTED", None)
                    stats["hitl_queued"] += 1
                    stats["no_consensus"] += 1
            
            # v10.4: Save cache every 25 records instead of every record
            if i % 25 == 0 or i == len(offices):
                save_rev_geo_cache()

        log.info("\nPHASE 3: SUMMARY")
        log.info(f"  Total:    {stats['total']}")
        log.info(f"  Applied:  {stats['auto_applied']}")
        log.info(f"  Queued:   {stats['hitl_queued']}")

    else:
        # â”€â”€ NEW GENERIC PATH (Additive for Wards/Diaspora) â”€â”€
        log.info(f"\nGENERIC RESOLVER v10.1: Table={args.table}")
        if args.id:
            resp = requests.get(f"{SUPABASE_URL}/rest/v1/{args.table}?id=eq.{args.id}&select=*", headers=HEADERS)
            records = resp.json()
        else:
            log.info(f"Fetching {args.table} (limit={args.limit})...")
            resp = requests.get(f"{SUPABASE_URL}/rest/v1/{args.table}?select=*&limit={args.limit}", headers=HEADERS)
            records = resp.json()

        log.info(f"Processing {len(records)} records...")
        for i, record in enumerate(records, 1):
            name = record.get(T_CFG["name"]) or f"ID:{record['id']}"
            context = record.get(T_CFG["context"]) or "Unknown"
            log.info(f"\n[{i}/{len(records)}] {name} ({context})")
            
            res = resolve_record_crossvalidated(record, context, T_CFG)
            consensus = compute_consensus(res["best_results"]) if res["best_results"] else None
            
            if consensus and consensus["confidence"] >= AUTO_APPLY_THRESHOLD:
                log.info(f"  âœ… Consensus: ({consensus['lat']:.5f}, {consensus['lng']:.5f}) conf={consensus['confidence']:.2f}")
                if args.apply:
                    # Best address
                    best_addr = ""
                    for s in consensus.get("source_details", []):
                        if s.get("display_name") and len(s["display_name"]) > len(best_addr):
                            best_addr = s["display_name"]
                    
                    ok = apply_resolution_generic(args.table, record["id"], consensus["lat"], consensus["lng"], 
                                                 consensus["confidence"], res["queries_used"], best_addr, record)
                    if ok: log.info(f"  âœ¨ APPLIED to {args.table}")
            else:
                log.warning("  âš ï¸  No validated consensus.")
            
            save_rev_geo_cache()

    if admin_task: admin_task.complete(f"Finished {args.table} resolution.")

if __name__ == "__main__":
    main()

