#!/usr/bin/env python3
"""
Multi-Source Consensus Geocoding Resolver for Nasaka IEBC

Queries Nominatim, Geocode.xyz, Geokeo, and Gemini AI to find the most
accurate coordinate for each flagged IEBC office.  Uses weighted-cluster
voting to produce a consensus coordinate.

Usage:
  python scripts/resolve_coordinates.py                    # Dry-run all flagged offices
  python scripts/resolve_coordinates.py --office-id 151    # Resolve one office
  python scripts/resolve_coordinates.py --apply            # Write results to Supabase
  python scripts/resolve_coordinates.py --max-resolve 20   # Limit batch size
"""

import os
import sys
import json
import time
import math
import logging
import argparse
import requests
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

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
NOMINATIM_RATE_LIMIT = 1.1  # seconds between requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("resolve")

# ── Per-County Adaptive Thresholds ────────────────────────────────────────────
# Large counties in Kenya can span >200km. A flat 50km threshold creates false
# positives. These values represent half the county's approximate diameter.

ADAPTIVE_THRESHOLDS_KM = {
    "turkana": 150, "marsabit": 200, "wajir": 150, "mandera": 200,
    "garissa": 150, "tana river": 120, "kitui": 100, "kajiado": 100,
    "narok": 100, "samburu": 100, "laikipia": 80, "baringo": 80,
    "west pokot": 80, "isiolo": 100, "makueni": 80, "machakos": 80,
    "kilifi": 80, "taita taveta": 80, "meru": 80, "nakuru": 80,
    "elgeyo-marakwet": 60,
}
DEFAULT_THRESHOLD_KM = 50

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

# ── Individual Geocoders ──────────────────────────────────────────────────────

def geocode_nominatim(query: str) -> Optional[Dict]:
    """OSM Nominatim — free, 1 req/s, countrycodes=ke."""
    try:
        time.sleep(NOMINATIM_RATE_LIMIT)
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "countrycodes": "ke", "format": "json", "limit": 1, "addressdetails": 1},
            headers={"User-Agent": "NasakaIEBC/1.0 (civiceducationkenya.com)"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None
        r = data[0]
        lat, lng = float(r["lat"]), float(r["lon"])
        if not is_in_kenya(lat, lng):
            return None
        return {
            "lat": lat, "lng": lng, "source": "nominatim",
            "confidence": min(float(r.get("importance", 0.5)) * 1.5, 1.0),
            "display_name": r.get("display_name", ""),
        }
    except Exception as e:
        log.warning(f"Nominatim failed: {e}")
        return None


def geocode_geocodexyz(query: str) -> Optional[Dict]:
    """Geocode.xyz — free, 1 req/s, region=KE."""
    try:
        time.sleep(1.1)
        resp = requests.get(
            f"https://geocode.xyz/{requests.utils.quote(query)}",
            params={"json": "1", "region": "KE"},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data or "error" in data or not data.get("latt") or not data.get("longt"):
            return None
        lat, lng = float(data["latt"]), float(data["longt"])
        if not is_in_kenya(lat, lng):
            return None
        conf = min(float(data.get("confidence", "45")) / 100, 1.0) if data.get("confidence") else 0.45
        return {"lat": lat, "lng": lng, "source": "geocode_xyz", "confidence": conf, "display_name": query}
    except Exception as e:
        log.warning(f"Geocode.xyz failed: {e}")
        return None


def geocode_geokeo(query: str) -> Optional[Dict]:
    """Geokeo — 2500/day, api key in env."""
    if not GEOKEO_API_KEY:
        return None
    try:
        time.sleep(0.2)
        resp = requests.get(
            "https://geokeo.com/geocode/v1/search.php",
            params={"q": query, "api": GEOKEO_API_KEY},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data or data.get("status") != "200" or not data.get("results"):
            return None
        r = data["results"][0]
        lat = float(r["geometry"]["location"]["lat"])
        lng = float(r["geometry"]["location"]["lng"])
        if not is_in_kenya(lat, lng):
            return None
        return {"lat": lat, "lng": lng, "source": "geokeo", "confidence": 0.6, "display_name": r.get("formatted_address", query)}
    except Exception as e:
        log.warning(f"Geokeo failed: {e}")
        return None


def geocode_gemini(constituency: str, county: str) -> Optional[Dict]:
    """Gemini AI — 60 RPM, lowest confidence (0.4) to mitigate hallucination."""
    if not GEMINI_API_KEY:
        return None
    try:
        time.sleep(1.1)
        prompt = (
            f"What are the GPS coordinates of the {constituency} IEBC constituency office "
            f"in {county} County, Kenya?\n\n"
            f'Return ONLY a valid JSON object: {{"lat": <number>, "lng": <number>}}\n'
            f'If uncertain, return: {{"lat": null, "lng": null}}'
        )
        resp = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}",
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.0, "maxOutputTokens": 100},
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        if not text:
            return None
        import re
        m = re.search(r'\{[^}]+\}', text)
        if not m:
            return None
        parsed = json.loads(m.group(0))
        if parsed.get("lat") is None or parsed.get("lng") is None:
            return None
        lat, lng = float(parsed["lat"]), float(parsed["lng"])
        if not is_in_kenya(lat, lng):
            return None
        return {"lat": lat, "lng": lng, "source": "gemini_ai", "confidence": 0.4, "display_name": f"{constituency} (Gemini)"}
    except Exception as e:
        log.warning(f"Gemini failed: {e}")
        return None

# ── Multi-Source Resolver ─────────────────────────────────────────────────────

def resolve_office(constituency: str, county: str, office_location: str = "") -> List[Dict]:
    """Run all geocoders and return list of results."""
    query = f"{constituency} IEBC office {county} county Kenya"
    results = []

    log.info(f"  🔍 Querying Nominatim...")
    r = geocode_nominatim(query)
    if r:
        results.append(r)
        log.info(f"    ✓ Nominatim: ({r['lat']:.5f}, {r['lng']:.5f}) conf={r['confidence']:.2f}")

    log.info(f"  🔍 Querying Geocode.xyz...")
    r = geocode_geocodexyz(query)
    if r:
        results.append(r)
        log.info(f"    ✓ Geocode.xyz: ({r['lat']:.5f}, {r['lng']:.5f}) conf={r['confidence']:.2f}")

    log.info(f"  🔍 Querying Geokeo...")
    r = geocode_geokeo(query)
    if r:
        results.append(r)
        log.info(f"    ✓ Geokeo: ({r['lat']:.5f}, {r['lng']:.5f}) conf={r['confidence']:.2f}")

    log.info(f"  🔍 Querying Gemini AI...")
    r = geocode_gemini(constituency, county)
    if r:
        results.append(r)
        log.info(f"    ✓ Gemini: ({r['lat']:.5f}, {r['lng']:.5f}) conf={r['confidence']:.2f}")

    if not results:
        log.warning(f"  ✗ All sources returned null for {constituency}")

    return results


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

# ── Supabase Operations ──────────────────────────────────────────────────────

def fetch_flagged_offices() -> List[Dict]:
    """Load the latest verification report and extract flagged office IDs."""
    report_path = Path("reports/latest_verification.json")
    if not report_path.exists():
        log.error("No verification report found at reports/latest_verification.json")
        return []

    with open(report_path) as f:
        report = json.load(f)

    # Collect unique office IDs from critical county_mismatch + clustering issues
    office_ids = set()
    issues_map = {}
    for issue in report.get("issues", []):
        if issue.get("severity") == "critical" and issue.get("type") == "county_mismatch":
            oid = issue["office_id"]
            office_ids.add(oid)
            issues_map[oid] = issue
        elif issue.get("type") == "clustering":
            for key in ["office_a_id", "office_b_id"]:
                if key in issue:
                    office_ids.add(issue[key])

    if not office_ids:
        log.info("No flagged offices found in verification report")
        return []

    # Fetch these offices from Supabase
    id_list = ",".join(f"eq.{oid}" for oid in office_ids)
    # Actually, use 'in' filter
    ids_csv = ",".join(str(oid) for oid in office_ids)
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/iebc_offices?id=in.({ids_csv})&select=id,constituency_name,county,office_location,latitude,longitude",
        headers={**HEADERS},
        timeout=15,
    )
    resp.raise_for_status()
    offices = resp.json()
    log.info(f"Fetched {len(offices)} flagged offices from database")
    return offices


def apply_resolution(office_id: int, lat: float, lng: float, confidence: float) -> bool:
    """Update an office's coordinates in Supabase."""
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/iebc_offices?id=eq.{office_id}",
        headers=HEADERS,
        json={
            "latitude": lat,
            "longitude": lng,
            "geocode_verified": True,
            "geocode_verified_at": datetime.now(timezone.utc).isoformat(),
            "multi_source_confidence": confidence,
            "geocode_method": "multi_source_consensus",
        },
        timeout=10,
    )
    return resp.status_code in (200, 204)


def log_audit(office: Dict, issue_type: str, new_lat: float, new_lng: float,
              consensus: Optional[Dict], applied: bool) -> Optional[str]:
    """Write an audit record to geocode_audit."""
    payload = {
        "office_id": office["id"],
        "constituency": office.get("constituency_name", ""),
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
        "resolution_method": "multi_source_consensus",
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
        log.warning(f"Audit log failed: {e}")
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
        log.warning(f"HITL enqueue failed: {e}")

# ── Main Pipeline ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Multi-Source IEBC Coordinate Resolver")
    parser.add_argument("--apply", action="store_true", help="Write resolved coords to Supabase")
    parser.add_argument("--all", action="store_true", help="Resolve ALL offices in the database")
    parser.add_argument("--office-id", type=int, help="Resolve a single office by ID")
    parser.add_argument("--max-resolve", type=int, default=999, help="Max offices to resolve in batch")
    parser.add_argument("--json-output", action="store_true", help="Output JSON summary")
    args = parser.parse_args()

    mode_label = "APPLY (LIVE)" if args.apply else "DRY RUN"
    log.info("=" * 70)
    log.info("MULTI-SOURCE CONSENSUS GEOCODING RESOLVER")
    log.info(f"Mode: {mode_label}")
    log.info("=" * 70)

    # Fetch offices to resolve
    if args.office_id:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/iebc_offices?id=eq.{args.office_id}&select=id,constituency_name,county,office_location,latitude,longitude",
            headers=HEADERS,
            timeout=10,
        )
        resp.raise_for_status()
        offices = resp.json()
    elif getattr(args, 'all', False):
        log.info("Fetching ALL offices from database...")
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/iebc_offices?select=id,constituency_name,county,office_location,latitude,longitude&order=id",
            headers=HEADERS,
            timeout=20,
        )
        resp.raise_for_status()
        offices = resp.json()
    else:
        offices = fetch_flagged_offices()

    if not offices:
        log.info("No offices to resolve.")
        return

    offices = offices[:args.max_resolve]
    log.info(f"Resolving {len(offices)} offices...\n")

    stats = {"resolved": 0, "auto_applied": 0, "hitl_queued": 0, "no_consensus": 0, "total": len(offices)}
    results_log = []

    for i, office in enumerate(offices, 1):
        name = office.get("constituency_name", f"ID:{office['id']}")
        county = office.get("county", "Unknown")
        log.info(f"[{i}/{len(offices)}] {name} ({county})")

        # Run multi-source resolver
        source_results = resolve_office(name, county, office.get("office_location", ""))
        consensus = compute_consensus(source_results)

        if consensus:
            log.info(f"  ✅ Consensus: ({consensus['lat']:.5f}, {consensus['lng']:.5f}) "
                     f"conf={consensus['confidence']:.2f} agree={consensus['agreement_count']}/{len(source_results)} "
                     f"spread={consensus['spread_km']:.2f}km")

            # Check displacement from current coords
            old_lat = office.get("latitude")
            old_lng = office.get("longitude")
            if old_lat and old_lng:
                displacement = haversine_km(old_lat, old_lng, consensus["lat"], consensus["lng"])
                log.info(f"  📐 Displacement from current: {displacement:.1f} km")
            else:
                displacement = 999  # null coords always need fixing

            issue_type = "NULL_COORDS" if (old_lat is None or old_lng is None) else "DISPLACED"

            if displacement <= DISPLACEMENT_THRESHOLD_KM:
                log.info(f"  ⏭️  Current coords are close enough — skipping")
                stats["resolved"] += 1
                results_log.append({"office_id": office["id"], "action": "skip", "displacement_km": displacement})
                continue

            if consensus["confidence"] >= AUTO_APPLY_THRESHOLD:
                if args.apply:
                    ok = apply_resolution(office["id"], consensus["lat"], consensus["lng"], consensus["confidence"])
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
                })
        else:
            log.warning(f"  ❌ No consensus — all sources failed")
            if args.apply:
                issue_type = "NULL_COORDS" if (office.get("latitude") is None) else "DISPLACED"
                enqueue_hitl(office, None, issue_type, None)
            stats["no_consensus"] += 1
            results_log.append({"office_id": office["id"], "action": "no_consensus"})

        log.info("")

    # Summary
    log.info("=" * 70)
    log.info("RESOLUTION SUMMARY")
    log.info(f"  Total offices:     {stats['total']}")
    log.info(f"  Resolved:          {stats['resolved']}")
    log.info(f"  Auto-applied:      {stats['auto_applied']}")
    log.info(f"  HITL queued:       {stats['hitl_queued']}")
    log.info(f"  No consensus:      {stats['no_consensus']}")
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
