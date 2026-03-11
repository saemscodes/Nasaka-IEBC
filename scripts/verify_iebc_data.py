#!/usr/bin/env python3
"""
verify_iebc_data.py — Daily IEBC Office Data Verification Script
================================================================
Automated verification script designed for both manual runs and CI/CD.

Features:
  - Fetches all offices from Supabase
  - Validates coordinates fall within correct county boundaries
  - Detects geometric clustering (markers too close together)
  - Cross-references coordinates with OpenStreetMap Nominatim
  - Auto-fixes known misplacements when --auto-fix flag is set
  - Generates a JSON discrepancy report for the admin dashboard
  - Exit code 1 if critical discrepancies found (useful for CI/CD)

Usage:
  python scripts/verify_iebc_data.py              # Full verification
  python scripts/verify_iebc_data.py --quick       # Skip Nominatim (fast)
  python scripts/verify_iebc_data.py --json-output # Print JSON to stdout
  python scripts/verify_iebc_data.py --auto-fix    # Auto-apply corrections
"""

import os
import sys
import json
import math
import time
import argparse
import logging
from pathlib import Path
from datetime import datetime, timezone

from typing import Dict, List, Tuple, Optional
import subprocess

# Admin Task Integration
try:
    from admin_task_lib import AdminTask
    HAS_ADMIN_LIB = True
except ImportError:
    HAS_ADMIN_LIB = False

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ============================================================================
# Configuration
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ftswzvqwxdwgkvfbwfpx.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", ""))
SUPABASE_ANON_KEY = os.getenv(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3d6dnF3eGR3Z2t2ZmJ3ZnB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTQ1NTEsImV4cCI6MjA2NzkzMDU1MX0.ZRYkA2uRUEG1M6zLpMI0waaprBORCl_sYQ8l3orhdUo"
)

REPORT_DIR = Path(__file__).parent.parent / "reports"
NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search"
NOMINATIM_USER_AGENT = "Nasaka-IEBC-Verifier/1.0 (civic-education-kenya)"

KENYA_BOUNDS = {
    "lat_min": -4.7, "lat_max": 5.1,
    "lon_min": 33.9, "lon_max": 42.0
}

# Maximum distance (meters) an office can be from its declared county centroid
# before being flagged as a county mismatch. 50km is generous for most counties.
COUNTY_MISMATCH_THRESHOLD_METERS = 50_000

# Kenya County Centroids — approximate geographic center of each county
# Used to validate that an office's coordinates are within its declared county.
KENYA_COUNTY_CENTROIDS: Dict[str, Tuple[float, float]] = {
    "baringo": (0.4667, 35.9667),
    "bomet": (-0.7817, 35.3417),
    "bungoma": (0.5636, 34.5606),
    "busia": (0.4347, 34.1114),
    "elgeyo-marakwet": (0.6897, 35.5097),
    "elgeyo marakwet": (0.6897, 35.5097),
    "embu": (-0.5389, 37.4592),
    "garissa": (-0.4532, 39.6461),
    "homa bay": (-0.5217, 34.4572),
    "homabay": (-0.5217, 34.4572),
    "isiolo": (0.3546, 38.4850),
    "kajiado": (-2.0981, 36.7819),
    "kakamega": (0.2827, 34.7519),
    "kericho": (-0.3693, 35.2863),
    "kiambu": (-1.1714, 36.8357),
    "kilifi": (-3.5107, 39.8553),
    "kirinyaga": (-0.4989, 37.2803),
    "kisii": (-0.6817, 34.7667),
    "kisumu": (-0.1000, 34.7617),
    "kitui": (-1.3651, 38.0109),
    "kwale": (-4.1816, 39.4525),
    "laikipia": (0.1800, 36.7819),
    "lamu": (-2.2717, 40.9022),
    "machakos": (-1.5177, 37.2634),
    "makueni": (-1.8039, 37.6230),
    "mandera": (3.9336, 41.8569),
    "marsabit": (2.3284, 37.9910),
    "meru": (0.0440, 37.6483),
    "migori": (-1.0634, 34.4731),
    "mombasa": (-4.0435, 39.6682),
    "murang'a": (-0.7210, 37.1526),
    "muranga": (-0.7210, 37.1526),
    "nairobi": (-1.2864, 36.8172),
    "nairobi city": (-1.2864, 36.8172),
    "nakuru": (-0.3031, 36.0800),
    "nandi": (0.1833, 35.1269),
    "narok": (-1.0833, 35.8667),
    "nyamira": (-0.5633, 34.9342),
    "nyandarua": (-0.3943, 36.5230),
    "nyeri": (-0.4246, 36.9510),
    "samburu": (1.2100, 36.9541),
    "siaya": (-0.0617, 34.2881),
    "taita-taveta": (-3.3961, 38.3577),
    "taita taveta": (-3.3961, 38.3577),
    "tana river": (-1.5000, 39.6500),
    "tharaka-nithi": (-0.3072, 37.8447),
    "tharaka nithi": (-0.3072, 37.8447),
    "trans-nzoia": (1.0567, 34.9506),
    "trans nzoia": (1.0567, 34.9506),
    "turkana": (3.1117, 35.5972),
    "uasin gishu": (0.5143, 35.2698),
    "vihiga": (0.0722, 34.7239),
    "wajir": (1.7500, 40.0583),
    "west pokot": (1.2167, 35.1167),
}

CLUSTER_THRESHOLD_METERS = 200
NOMINATIM_RATE_LIMIT_SECONDS = 1.1
MAX_ACCEPTABLE_SHIFT_METERS = 5000


# ============================================================================
# Utilities
# ============================================================================

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in meters between two lat/lon pairs."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dl/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def is_in_kenya(lat: float, lon: float) -> bool:
    return (KENYA_BOUNDS["lat_min"] <= lat <= KENYA_BOUNDS["lat_max"] and
            KENYA_BOUNDS["lon_min"] <= lon <= KENYA_BOUNDS["lon_max"])


# ============================================================================
# Supabase Client
# ============================================================================

class SupabaseClient:
    def __init__(self, url: str, key: str):
        self.base_url = url.rstrip('/')
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }

    def fetch_all_offices(self) -> List[Dict]:
        url = f"{self.base_url}/rest/v1/iebc_offices"
        params = {"select": "*", "order": "id"}
        all_data = []
        offset = 0
        limit = 1000

        while True:
            params["offset"] = offset
            params["limit"] = limit
            resp = requests.get(url, headers=self.headers, params=params)
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            all_data.extend(batch)
            if len(batch) < limit:
                break
            offset += limit

        return all_data


# ============================================================================
# Verification Checks
# ============================================================================

def check_null_coordinates(offices: List[Dict]) -> List[Dict]:
    """Find offices with missing coordinates."""
    issues = []
    for office in offices:
        lat = office.get("latitude")
        lon = office.get("longitude")
        if lat is None or lon is None:
            issues.append({
                "type": "null_coordinates",
                "severity": "critical",
                "office_id": office["id"],
                "constituency": office.get("constituency") or office.get("constituency_name", ""),
                "county": office.get("county", ""),
                "message": "Missing latitude or longitude",
            })
    return issues


def check_out_of_bounds(offices: List[Dict]) -> List[Dict]:
    """Find offices with coordinates outside Kenya."""
    issues = []
    for office in offices:
        lat = office.get("latitude")
        lon = office.get("longitude")
        if lat is not None and lon is not None:
            if not is_in_kenya(lat, lon):
                issues.append({
                    "type": "out_of_bounds",
                    "severity": "critical",
                    "office_id": office["id"],
                    "constituency": office.get("constituency") or office.get("constituency_name", ""),
                    "county": office.get("county", ""),
                    "latitude": lat,
                    "longitude": lon,
                    "message": f"Coordinates ({lat}, {lon}) are outside Kenya",
                })
    return issues


def check_clustering(offices: List[Dict]) -> List[Dict]:
    """
    Detect geometric clustering — offices too close together.
    Uses spatial grid bucketing for O(n) performance with thousands of offices.
    """
    issues = []
    valid_offices = [
        o for o in offices
        if o.get("latitude") is not None and o.get("longitude") is not None
    ]

    # Grid cell size in degrees (~200m at equator, close enough for Kenya near equator)
    CELL_SIZE = CLUSTER_THRESHOLD_METERS / 111_000  # ~0.0018 degrees

    # Bucket offices into grid cells
    grid: Dict[Tuple[int, int], List[Dict]] = {}
    for office in valid_offices:
        cell_x = int(office["latitude"] / CELL_SIZE)
        cell_y = int(office["longitude"] / CELL_SIZE)
        key = (cell_x, cell_y)
        if key not in grid:
            grid[key] = []
        grid[key].append(office)

    # Only compare offices in the same or adjacent cells
    checked_pairs: set = set()
    for (cx, cy), cell_offices in grid.items():
        neighbors = []
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                neighbors.extend(grid.get((cx + dx, cy + dy), []))

        for office_a in cell_offices:
            for office_b in neighbors:
                if office_a["id"] >= office_b["id"]:
                    continue
                pair_key = (office_a["id"], office_b["id"])
                if pair_key in checked_pairs:
                    continue
                checked_pairs.add(pair_key)

                dist = haversine(
                    office_a["latitude"], office_a["longitude"],
                    office_b["latitude"], office_b["longitude"]
                )

                constituency_a = (office_a.get("constituency") or office_a.get("constituency_name", "")).lower()
                constituency_b = (office_b.get("constituency") or office_b.get("constituency_name", "")).lower()

                if dist < CLUSTER_THRESHOLD_METERS and constituency_a != constituency_b:
                    issues.append({
                        "type": "clustering",
                        "severity": "warning",
                        "office_a_id": office_a["id"],
                        "office_a_constituency": constituency_a,
                        "office_b_id": office_b["id"],
                        "office_b_constituency": constituency_b,
                        "distance_meters": round(dist, 1),
                        "county": office_a.get("county", ""),
                        "message": (
                            f"{constituency_a} and {constituency_b} are only "
                            f"{round(dist, 1)}m apart (threshold: {CLUSTER_THRESHOLD_METERS}m)"
                        ),
                    })

    return issues


def check_county_mismatch(offices: List[Dict]) -> List[Dict]:
    """
    Validate each office's coordinates fall within a reasonable distance
    of its declared county centroid. This catches the critical error where
    an office's coordinates are placed in the wrong county entirely.
    """
    issues = []
    for office in offices:
        lat = office.get("latitude")
        lon = office.get("longitude")
        county = (office.get("county") or "").strip().lower()

        if lat is None or lon is None or not county:
            continue

        centroid = KENYA_COUNTY_CENTROIDS.get(county)
        if not centroid:
            # Try without hyphens/special chars
            county_clean = county.replace("-", " ").replace("'", "")
            centroid = KENYA_COUNTY_CENTROIDS.get(county_clean)

        if not centroid:
            continue

        dist = haversine(lat, lon, centroid[0], centroid[1])

        if dist > COUNTY_MISMATCH_THRESHOLD_METERS:
            constituency = office.get("constituency") or office.get("constituency_name", "")
            issues.append({
                "type": "county_mismatch",
                "severity": "critical",
                "office_id": office["id"],
                "constituency": constituency,
                "county": office.get("county", ""),
                "latitude": lat,
                "longitude": lon,
                "county_centroid_lat": centroid[0],
                "county_centroid_lon": centroid[1],
                "distance_from_county_km": round(dist / 1000, 1),
                "message": (
                    f"{constituency} ({office.get('county', '')}) is {round(dist / 1000, 1)}km "
                    f"from county centroid — likely misplaced coordinates"
                ),
            })

    return issues



def check_duplicates(offices: List[Dict]) -> List[Dict]:
    """Find duplicate constituency entries."""
    issues = []
    seen: Dict[str, Dict] = {}

    for office in offices:
        constituency = (office.get("constituency") or office.get("constituency_name", "")).strip().lower()
        if not constituency:
            continue

        if constituency in seen:
            issues.append({
                "type": "duplicate",
                "severity": "warning",
                "office_id_1": seen[constituency]["id"],
                "office_id_2": office["id"],
                "constituency": constituency,
                "county": office.get("county", ""),
                "message": f"Duplicate entry for constituency: {constituency}",
            })
        else:
            seen[constituency] = office

    return issues


def check_nominatim(offices: List[Dict]) -> List[Dict]:
    """Cross-reference with OpenStreetMap Nominatim (rate-limited)."""
    issues = []
    valid_offices = [
        o for o in offices
        if o.get("latitude") is not None and o.get("longitude") is not None
    ]

    headers = {"User-Agent": NOMINATIM_USER_AGENT}

    for office in valid_offices:
        constituency = office.get("constituency") or office.get("constituency_name", "")
        county = office.get("county", "")

        if not constituency:
            continue

        query = f"IEBC Office {constituency}, {county}, Kenya"
        try:
            resp = requests.get(
                NOMINATIM_BASE,
                params={"q": query, "format": "json", "limit": 1, "countrycodes": "ke"},
                headers=headers,
                timeout=10
            )
            time.sleep(NOMINATIM_RATE_LIMIT_SECONDS)

            if resp.status_code == 200:
                results = resp.json()
                if results:
                    nom_lat = float(results[0]["lat"])
                    nom_lon = float(results[0]["lon"])
                    db_lat = office["latitude"]
                    db_lon = office["longitude"]
                    shift = haversine(db_lat, db_lon, nom_lat, nom_lon)

                    if shift > MAX_ACCEPTABLE_SHIFT_METERS:
                        issues.append({
                            "type": "nominatim_mismatch",
                            "severity": "info",
                            "office_id": office["id"],
                            "constituency": constituency,
                            "county": county,
                            "db_lat": db_lat,
                            "db_lon": db_lon,
                            "nominatim_lat": nom_lat,
                            "nominatim_lon": nom_lon,
                            "shift_meters": round(shift, 1),
                            "message": (
                                f"Database coords ({db_lat}, {db_lon}) differ from "
                                f"Nominatim ({nom_lat}, {nom_lon}) by {round(shift, 1)}m"
                            ),
                        })

        except Exception as e:
            logger.warning(f"Nominatim lookup failed for {constituency}: {e}")

    return issues


# ============================================================================
# Main Verification Pipeline
# ============================================================================

def run_verification(offices: List[Dict], skip_nominatim: bool = False) -> Dict:
    """Run all verification checks and return a structured report."""
    logger.info(f"Running verification on {len(offices)} offices...")

    all_issues = []

    logger.info("  [1/6] Checking for null coordinates...")
    all_issues.extend(check_null_coordinates(offices))

    logger.info("  [2/6] Checking for out-of-bounds coordinates...")
    all_issues.extend(check_out_of_bounds(offices))

    logger.info("  [3/6] Validating county-coordinate alignment...")
    all_issues.extend(check_county_mismatch(offices))

    logger.info("  [4/6] Detecting geometric clustering...")
    all_issues.extend(check_clustering(offices))

    logger.info("  [5/6] Checking for duplicate entries...")
    all_issues.extend(check_duplicates(offices))

    if not skip_nominatim:
        logger.info("  [6/6] Cross-referencing with Nominatim (this may take a while)...")
        all_issues.extend(check_nominatim(offices))
    else:
        logger.info("  [6/6] Skipping Nominatim check (--quick mode)")

    critical_count = sum(1 for i in all_issues if i.get("severity") == "critical")
    warning_count = sum(1 for i in all_issues if i.get("severity") == "warning")
    info_count = sum(1 for i in all_issues if i.get("severity") == "info")

    report = {
        "verification_timestamp": datetime.now(timezone.utc).isoformat(),
        "total_offices": len(offices),
        "total_issues": len(all_issues),
        "critical_issues": critical_count,
        "warning_issues": warning_count,
        "info_issues": info_count,
        "health_score": max(0, 100 - (critical_count * 10) - (warning_count * 3) - info_count),
        "issues": all_issues,
    }

    return report


def save_report(report: Dict, output_dir: Path) -> Path:
    """Save the verification report to disk."""
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    path = output_dir / f"verification_report_{timestamp}.json"

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, default=str)

    latest_path = output_dir / "latest_verification.json"
    with open(latest_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, default=str)

    logger.info(f"Report saved to {path}")
    logger.info(f"Latest symlink: {latest_path}")
    return path


# ============================================================================
# Main
# ============================================================================

def run_auto_fix() -> bool:
    """
    Run fix_all_coords.py --apply to auto-correct known misplacements.
    Returns True if fix script ran successfully.
    """
    fix_script = Path(__file__).parent / "fix_all_coords.py"
    if not fix_script.exists():
        logger.error(f"Auto-fix script not found at {fix_script}")
        return False

    logger.info("\n" + "=" * 60)
    logger.info("AUTO-FIX: Running fix_all_coords.py --apply")
    logger.info("=" * 60)

    try:
        result = subprocess.run(
            [sys.executable, str(fix_script), "--apply"],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.stdout:
            for line in result.stdout.strip().split("\n"):
                logger.info(f"  [fix] {line}")
        if result.returncode != 0 and result.stderr:
            logger.warning(f"  [fix] stderr: {result.stderr[:500]}")
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        logger.error("Auto-fix script timed out after 120s")
        return False
    except Exception as e:
        logger.error(f"Auto-fix failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="IEBC Office Data Verification Tool")
    parser.add_argument("--quick", action="store_true", help="Skip Nominatim cross-reference")
    parser.add_argument("--json-output", action="store_true", help="Print JSON report to stdout")
    parser.add_argument("--auto-fix", action="store_true", help="Auto-apply corrections from fix_all_coords.py when critical issues found")
    parser.add_argument("--task-id", help="Admin Task ID for HITL reporting")
    args = parser.parse_args()

    # Initialize Admin Task if ID provided
    task = None
    task_id = args.task_id or os.getenv("ADMIN_TASK_ID")
    if task_id and HAS_ADMIN_LIB:
        task = AdminTask(task_id)
        task.log("Initialising IEBC Data Verification Task...", level='step')

    if not HAS_REQUESTS:
        msg = "'requests' library required. Install with: pip install requests"
        if task: task.fail(msg)
        logger.error(msg)
        sys.exit(1)

    api_key = SUPABASE_KEY or SUPABASE_ANON_KEY
    if not api_key:
        msg = "No Supabase key found."
        if task: task.fail(msg)
        logger.error(msg)
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("IEBC Office Data Verification Tool")
    logger.info("=" * 60)

    if task: task.log("Fetching offices from Supabase...", level='info')
    client = SupabaseClient(SUPABASE_URL, api_key)
    try:
        offices = client.fetch_all_offices()
        logger.info(f"Fetched {len(offices)} offices from database")
        if task: task.log(f"Successfully fetched {len(offices)} offices.", level='info')
    except Exception as e:
        if task: task.fail(f"Failed to fetch offices: {str(e)}")
        raise

    # Override logging to pipe to Task Runner
    if task:
        # Wrap the verification to log steps
        logger.info("  [1/6] Checking for null coordinates...")
        task.log("Checking for null coordinates...", level='step')
        null_issues = check_null_coordinates(offices)
        
        logger.info("  [2/6] Checking for out-of-bounds coordinates...")
        task.log("Checking for out-of-bounds coordinates...", level='step')
        oob_issues = check_out_of_bounds(offices)
        
        logger.info("  [3/6] Validating county-coordinate alignment...")
        task.log("Validating county-coordinate alignment...", level='step')
        county_issues = check_county_mismatch(offices)
        
        logger.info("  [4/6] Detecting geometric clustering...")
        task.log("Detecting geometric clustering...", level='step')
        cluster_issues = check_clustering(offices)
        
        logger.info("  [5/6] Checking for duplicate entries...")
        task.log("Checking for duplicate entries...", level='step')
        duplicate_issues = check_duplicates(offices)
        
        nom_issues = []
        if not args.quick:
            logger.info("  [6/6] Cross-referencing with Nominatim...")
            task.log("Cross-referencing with Nominatim (Heavy Task)...", level='step')
            nom_issues = check_nominatim(offices)
            
        all_issues = null_issues + oob_issues + county_issues + cluster_issues + duplicate_issues + nom_issues
        
        critical_count = sum(1 for i in all_issues if i.get("severity") == "critical")
        warning_count = sum(1 for i in all_issues if i.get("severity") == "warning")
        
        report = {
            "verification_timestamp": datetime.now(timezone.utc).isoformat(),
            "total_offices": len(offices),
            "total_issues": len(all_issues),
            "critical_issues": critical_count,
            "warning_issues": warning_count,
            "info_issues": sum(1 for i in all_issues if i.get("severity") == "info"),
            "health_score": max(0, 100 - (critical_count * 10) - (warning_count * 3)),
            "issues": all_issues,
        }
    else:
        report = run_verification(offices, skip_nominatim=args.quick)

    logger.info(f"\n{'='*60}")
    logger.info(f"VERIFICATION RESULTS:")
    logger.info(f"  Health score: {report['health_score']}/100")
    logger.info(f"{'='*60}\n")

    if report["issues"]:
        if task: task.log(f"Found {len(report['issues'])} potential issues.", level='warn')
        for issue in report["issues"][:10]:
            severity_icon = {"critical": "🔴", "warning": "🟡", "info": "🔵"}.get(issue.get("severity"), "⚪")
            logger.info(f"  {severity_icon} [{issue['type']}] {issue['message']}")

    save_report(report, REPORT_DIR)

    if args.json_output:
        print(json.dumps(report, indent=2, default=str))

    # Auto-fix: if critical issues found and --auto-fix is set, run corrections
    if args.auto_fix and report["critical_issues"] > 0:
        logger.info(f"\n⚠️  {report['critical_issues']} critical issues found — running auto-fix...")
        fix_success = run_auto_fix()

        if fix_success:
            logger.info("\n🔄 Re-running verification after auto-fix...")
            # Re-fetch offices and re-verify
            try:
                offices = client.fetch_all_offices()
                post_fix_report = run_verification(offices, skip_nominatim=True)
                save_report(post_fix_report, REPORT_DIR)

                logger.info(f"\nPOST-FIX RESULTS:")
                logger.info(f"  Health score: {report['health_score']}/100 → {post_fix_report['health_score']}/100")
                logger.info(f"  Critical issues: {report['critical_issues']} → {post_fix_report['critical_issues']}")

                if post_fix_report["critical_issues"] == 0:
                    logger.info("\n✅ All critical issues resolved by auto-fix.")
                    if task:
                        task.complete(f"Auto-fix resolved all critical issues. Health: {post_fix_report['health_score']}/100")
                    sys.exit(0)
                else:
                    logger.warning(f"\n⚠️  {post_fix_report['critical_issues']} critical issues remain after auto-fix.")
            except Exception as e:
                logger.error(f"Post-fix verification failed: {e}")
        else:
            logger.warning("Auto-fix script failed. Manual intervention required.")

    # Final exit
    if task:
        if report["critical_issues"] > 0:
            task.fail(f"Verification failed with {report['critical_issues']} critical issues.")
        else:
            task.complete(f"Verification successful. Health score: {report['health_score']}/100")

    if report["critical_issues"] > 0:
        logger.warning(f"\n⚠️  {report['critical_issues']} CRITICAL issues found!")
        sys.exit(1)
    else:
        logger.info("\n✅ No critical issues found.")
        sys.exit(0)


if __name__ == "__main__":
    main()
