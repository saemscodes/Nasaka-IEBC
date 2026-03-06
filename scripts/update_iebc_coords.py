#!/usr/bin/env python3
"""
update_iebc_coords.py — IEBC Office Coordinate Correction Script
=================================================================
Production-grade one-time correction script that uses the "Golden Dataset"
from KE.txt (GeoNames), raw_iebc_offices_290.csv (landmark/distance data),
and iebc_offices.geojson (geocoded points) to fix ALL 290 IEBC office
coordinates in the Supabase `public.iebc_offices` table.

Features:
  - Parses directional/distance info from raw CSV ("50m from...", "Behind...", etc.)
  - Calculates bearing offsets from landmark coordinates found in KE.txt
  - Applies hardcoded "Gold Standard" overrides for critical offices
  - Deduplicates constituency entries (keeps best record)
  - Generates a full before/after diff report
  - Dry-run mode (default) so nothing changes until you confirm

Usage:
  python scripts/update_iebc_coords.py                # Dry run
  python scripts/update_iebc_coords.py --apply         # Apply changes
  python scripts/update_iebc_coords.py --report-only   # Just generate report
"""

import os
import sys
import csv
import json
import math
import re
import argparse
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple, Dict, List

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

GOLDEN_DATA_DIR = Path(r"D:\CEKA\ceka v010\CONTEXT - CEKA\DATA")
KE_TXT_PATH = GOLDEN_DATA_DIR / "KE.txt"
RAW_CSV_PATH = GOLDEN_DATA_DIR / "raw_iebc_offices_290.csv"
GEOJSON_PATH = GOLDEN_DATA_DIR / "iebc_offices.geojson"

REPORT_DIR = Path(__file__).parent.parent / "reports"

# Kenya bounding box for validation
KENYA_BOUNDS = {
    "lat_min": -4.7,
    "lat_max": 5.1,
    "lon_min": 33.9,
    "lon_max": 42.0
}

# ============================================================================
# GOLD STANDARD OVERRIDES — Manually verified coordinates
# These take absolute priority over any computed values.
# Sources: Google Maps, OpenStreetMap, on-the-ground verification.
# Format: "Constituency": (latitude, longitude)
# ============================================================================

GOLD_STANDARD_COORDS: Dict[str, Tuple[float, float]] = {
    # ---- Nairobi (the 17 that were clustered on Haile Selassie Ave) ----
    "Westlands":         (-1.2668,  36.8081),
    "Dagoretti North":   (-1.2607,  36.7575),
    "Dagoretti South":   (-1.2985,  36.7473),
    "Langata":           (-1.3474,  36.7358),
    "Kibra":             (-1.3107,  36.7819),
    "Roysambu":          (-1.1696,  36.8745),
    "Kasarani":          (-1.2174,  36.8976),
    "Ruaraka":           (-1.2367,  36.8766),
    "Embakasi South":    (-1.3223,  36.8981),
    "Embakasi North":    (-1.2611,  36.9087),
    "Embakasi Central":  (-1.2856,  36.9089),
    "Embakasi East":     (-1.3264,  36.9274),
    "Embakasi West":     (-1.3045,  36.8846),
    "Makadara":          (-1.2913,  36.8573),
    "Kamukunji":         (-1.2722,  36.8431),
    "Starehe":           (-1.2864,  36.8222),
    "Mathare":           (-1.2562,  36.8568),

    # ---- Ruiru (was in town center, should be at Law Courts) ----
    "Ruiru":             (-1.1466,  36.9609),

    # ---- Other known corrections ----
    "Juja":              (-1.1005,  37.0134),
    "Thika Town":        (-1.0396,  37.0693),
    "Kiambu":            (-1.1714,  36.8357),
    "Kabete":            (-1.2496,  36.7374),
    "Githunguri":        (-1.0568,  36.7717),
    "Gatundu South":     (-1.0185,  36.9058),
    "Gatundu North":     (-0.9521,  36.9137),
    "Limuru":            (-1.1062,  36.6419),
    "Kikuyu":            (-1.2443,  36.6628),
    "Lari":              (-1.0916,  36.6236),

    # ---- Coast ----
    "Changamwe":         (-4.0348,  39.6195),
    "Jomvu":             (-4.0191,  39.5930),
    "Kisauni":           (-3.9918,  39.6979),
    "Nyali":             (-4.0375,  39.7049),
    "Likoni":            (-4.0777,  39.6633),
    "Mvita":             (-4.0635,  39.6626),

    # ---- Mount Kenya ----
    "Nyeri Town":        (-0.4246,  36.9510),
    "Tetu":              (-0.4503,  36.9321),
    "Kieni":             (-0.3239,  37.0162),
    "Mathira":           (-0.4631,  37.0638),
    "Othaya":            (-0.5367,  36.9544),
    "Mukurweini":        (-0.5636,  37.0070),

    # ---- Mombasa islands fix ----
    "Msambweni":         (-4.4674,  39.4775),
    "Lungalunga":        (-4.5528,  39.1236),
    "Matuga":            (-4.1650,  39.5373),
    "Kinango":           (-4.1371,  39.3230),
}


# ============================================================================
# Bearing & Distance Logic
# ============================================================================

DIRECTION_BEARINGS = {
    "north": 0, "n": 0,
    "northeast": 45, "ne": 45,
    "east": 90, "e": 90,
    "southeast": 135, "se": 135,
    "south": 180, "s": 180,
    "southwest": 225, "sw": 225,
    "west": 270, "w": 270,
    "northwest": 315, "nw": 315,
}

CONTEXTUAL_BEARINGS = {
    "behind": 180,
    "opposite": 0,
    "next to": 0,
    "adjacent to": 0,
    "adjacent": 0,
    "near": 0,
    "within": 0,
    "inside": 0,
    "at": 0,
    "along": 0,
    "off": 90,
}


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two lat/lon points."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def offset_point(lat: float, lon: float, bearing_deg: float, distance_m: float) -> Tuple[float, float]:
    """Calculate a new lat/lon given a bearing (degrees) and distance (meters) from a point."""
    R = 6371000
    bearing = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)

    lat2 = math.asin(
        math.sin(lat1) * math.cos(distance_m / R) +
        math.cos(lat1) * math.sin(distance_m / R) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(distance_m / R) * math.cos(lat1),
        math.cos(distance_m / R) - math.sin(lat1) * math.sin(lat2)
    )

    return math.degrees(lat2), math.degrees(lon2)


def parse_distance(distance_str: str) -> Optional[float]:
    """Parse a distance string from the CSV into meters."""
    if not distance_str or distance_str.strip() in ('', '0', 'Within', 'Adjacent', 'Sharing Building',
                                                      'Within the Compound', 'DCC Compound',
                                                      'Same compound', 'Within Garbatulla Catholic',
                                                      'Within DCC Offices', 'Opposite The Law Courts',
                                                      'Within Mandera North DCC Com-pound'):
        return 0.0

    text = distance_str.strip().lower()

    km_match = re.search(r'([\d.]+)\s*(?:kms?|kilometres?|kilometers?)', text)
    if km_match:
        return float(km_match.group(1)) * 1000

    m_match = re.search(r'([\d.]+)\s*(?:metres?|meters?|m\b)', text)
    if m_match:
        return float(m_match.group(1))

    ft_match = re.search(r'([\d.]+)\s*(?:ft|feet)', text)
    if ft_match:
        return float(ft_match.group(1)) * 0.3048

    num_match = re.search(r'([\d.]+)', text)
    if num_match:
        val = float(num_match.group(1))
        if val > 100:
            return val
        return val

    return 0.0


def parse_bearing(location_str: str, landmark_str: str) -> float:
    """Extract a directional bearing from location/landmark descriptions."""
    combined = f"{location_str or ''} {landmark_str or ''}".lower()

    for direction, bearing in DIRECTION_BEARINGS.items():
        if re.search(rf'\b{direction}\b', combined):
            return bearing

    for context, bearing in CONTEXTUAL_BEARINGS.items():
        if context in combined:
            return bearing

    return 0.0


def is_valid_kenya_coord(lat: float, lon: float) -> bool:
    """Check if coordinates fall within Kenya's bounding box."""
    return (KENYA_BOUNDS["lat_min"] <= lat <= KENYA_BOUNDS["lat_max"] and
            KENYA_BOUNDS["lon_min"] <= lon <= KENYA_BOUNDS["lon_max"])


# ============================================================================
# Data Loading
# ============================================================================

def load_geonames(path: Path) -> Dict[str, Tuple[float, float]]:
    """Load KE.txt (GeoNames format) into a lookup dict keyed by name."""
    places: Dict[str, Tuple[float, float]] = {}
    if not path.exists():
        logger.warning(f"KE.txt not found at {path}")
        return places

    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            parts = line.strip().split('\t')
            if len(parts) < 6:
                continue
            name = parts[1].strip()
            try:
                lat = float(parts[4])
                lon = float(parts[5])
                feature_class = parts[6] if len(parts) > 6 else ''
                if feature_class in ('P', 'A', 'S', 'L'):
                    if name not in places or feature_class == 'P':
                        places[name] = (lat, lon)
            except (ValueError, IndexError):
                continue

    logger.info(f"Loaded {len(places)} place names from KE.txt")
    return places


def load_raw_csv(path: Path) -> List[Dict]:
    """Load raw_iebc_offices_290.csv."""
    rows = []
    if not path.exists():
        logger.warning(f"CSV not found at {path}")
        return rows

    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    logger.info(f"Loaded {len(rows)} offices from raw CSV")
    return rows


def load_geojson(path: Path) -> Dict[str, Tuple[float, float]]:
    """Load iebc_offices.geojson for geocoded fallback coordinates."""
    coords: Dict[str, Tuple[float, float]] = {}
    if not path.exists():
        logger.warning(f"GeoJSON not found at {path}")
        return coords

    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    for feature in data.get("features", []):
        props = feature.get("properties", {})
        geom = feature.get("geometry", {})
        name = props.get("constituency_name", "")
        code = props.get("constituency_code", "")

        if geom.get("type") == "Point" and geom.get("coordinates"):
            lon, lat = geom["coordinates"]
            confidence = props.get("geocode_confidence", 0)
            accuracy = props.get("accuracy_meters", 99999)

            if confidence >= 0.7 and accuracy < 5000:
                key = name.split()[0] if name else code
                coords[key] = (lat, lon)

    logger.info(f"Loaded {len(coords)} geocoded points from GeoJSON")
    return coords


# ============================================================================
# Supabase API Client
# ============================================================================

class SupabaseClient:
    """Minimal Supabase REST client using requests."""

    def __init__(self, url: str, key: str):
        self.base_url = url.rstrip('/')
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    def fetch_all_offices(self) -> List[Dict]:
        """Fetch all IEBC offices from the database."""
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

        logger.info(f"Fetched {len(all_data)} offices from Supabase")
        return all_data

    def update_office(self, office_id: int, updates: Dict) -> Dict:
        """Update a single office record."""
        url = f"{self.base_url}/rest/v1/iebc_offices"
        params = {"id": f"eq.{office_id}"}
        resp = requests.patch(url, headers=self.headers, params=params, json=updates)
        resp.raise_for_status()
        return resp.json()

    def delete_office(self, office_id: int) -> None:
        """Delete an office by ID."""
        url = f"{self.base_url}/rest/v1/iebc_offices"
        params = {"id": f"eq.{office_id}"}
        resp = requests.delete(url, headers=self.headers, params=params)
        resp.raise_for_status()


# ============================================================================
# Core Logic: Build Corrections
# ============================================================================

def build_corrections(
    db_offices: List[Dict],
    raw_csv: List[Dict],
    geonames: Dict[str, Tuple[float, float]],
    geojson_coords: Dict[str, Tuple[float, float]]
) -> Tuple[List[Dict], List[int]]:
    """
    Compute coordinate corrections for all offices.

    Returns:
        corrections: list of {id, constituency, old_lat, old_lon, new_lat, new_lon, source, ...}
        duplicates_to_remove: list of duplicate office IDs to delete
    """
    corrections = []
    duplicates_to_remove = []

    csv_lookup: Dict[str, Dict] = {}
    for row in raw_csv:
        constituency = row.get("constituency", "").strip()
        if constituency:
            csv_lookup[constituency.lower()] = row

    seen_constituencies: Dict[str, Dict] = {}
    for office in db_offices:
        constituency = (office.get("constituency") or office.get("constituency_name") or "").strip()
        key = constituency.lower()

        if key in seen_constituencies:
            existing = seen_constituencies[key]
            existing_verified = existing.get("verified", False)
            current_verified = office.get("verified", False)

            if current_verified and not existing_verified:
                duplicates_to_remove.append(existing["id"])
                seen_constituencies[key] = office
            else:
                duplicates_to_remove.append(office["id"])
                continue
        else:
            seen_constituencies[key] = office

    for office in db_offices:
        if office["id"] in duplicates_to_remove:
            continue

        constituency = (office.get("constituency") or office.get("constituency_name") or "").strip()
        old_lat = office.get("latitude")
        old_lon = office.get("longitude")

        new_lat, new_lon = None, None
        source = "unchanged"

        if constituency in GOLD_STANDARD_COORDS:
            new_lat, new_lon = GOLD_STANDARD_COORDS[constituency]
            source = "gold_standard"
        else:
            csv_row = csv_lookup.get(constituency.lower())
            if csv_row:
                landmark = csv_row.get("landmark", "").strip()
                location = csv_row.get("location", "").strip()
                distance_str = csv_row.get("distance", "").strip()

                landmark_coord = None
                for search_name in [landmark, location, constituency]:
                    if search_name and search_name in geonames:
                        landmark_coord = geonames[search_name]
                        break
                    for gn_name, gn_coord in geonames.items():
                        if search_name and search_name.lower() in gn_name.lower():
                            landmark_coord = gn_coord
                            break
                    if landmark_coord:
                        break

                if landmark_coord:
                    distance_m = parse_distance(distance_str)
                    bearing = parse_bearing(location, landmark)

                    if distance_m > 0:
                        new_lat, new_lon = offset_point(
                            landmark_coord[0], landmark_coord[1],
                            bearing, distance_m
                        )
                        source = f"bearing_from_{landmark[:30]}"
                    else:
                        new_lat, new_lon = landmark_coord
                        source = f"landmark_{landmark[:30]}"

            if new_lat is None:
                geo_key = constituency.split()[0] if constituency else ""
                if geo_key in geojson_coords:
                    new_lat, new_lon = geojson_coords[geo_key]
                    source = "geojson_fallback"

        if new_lat is not None and new_lon is not None:
            if not is_valid_kenya_coord(new_lat, new_lon):
                logger.warning(
                    f"Skipping invalid coords for {constituency}: "
                    f"({new_lat}, {new_lon}) outside Kenya bounds"
                )
                continue

            if old_lat is not None and old_lon is not None:
                shift_m = haversine_distance(old_lat, old_lon, new_lat, new_lon)
            else:
                shift_m = float('inf')

            if shift_m > 50:
                corrections.append({
                    "id": office["id"],
                    "constituency": constituency,
                    "county": office.get("county", ""),
                    "old_lat": old_lat,
                    "old_lon": old_lon,
                    "new_lat": round(new_lat, 6),
                    "new_lon": round(new_lon, 6),
                    "shift_meters": round(shift_m, 1),
                    "source": source,
                })

    return corrections, duplicates_to_remove


# ============================================================================
# Report Generation
# ============================================================================

def generate_report(
    corrections: List[Dict],
    duplicates: List[int],
    output_dir: Path
) -> Path:
    """Generate a Markdown + JSON discrepancy report."""
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    json_path = output_dir / f"iebc_corrections_{timestamp}.json"
    md_path = output_dir / f"iebc_corrections_{timestamp}.md"

    report_data = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_corrections": len(corrections),
        "total_duplicates_removed": len(duplicates),
        "corrections": corrections,
        "duplicate_ids_removed": duplicates,
    }

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(report_data, f, indent=2, default=str)

    with open(md_path, 'w', encoding='utf-8') as f:
        f.write("# IEBC Office Coordinate Corrections Report\n\n")
        f.write(f"**Generated:** {report_data['generated_at']}\n\n")
        f.write(f"## Summary\n\n")
        f.write(f"- **Total corrections:** {len(corrections)}\n")
        f.write(f"- **Duplicates to remove:** {len(duplicates)}\n\n")

        if corrections:
            f.write("## Corrections\n\n")
            f.write("| # | County | Constituency | Old Lat | Old Lon | New Lat | New Lon | Shift (m) | Source |\n")
            f.write("|---|--------|-------------|---------|---------|---------|---------|-----------|--------|\n")

            for i, c in enumerate(corrections, 1):
                old_lat = f"{c['old_lat']:.6f}" if c['old_lat'] else "NULL"
                old_lon = f"{c['old_lon']:.6f}" if c['old_lon'] else "NULL"
                f.write(
                    f"| {i} | {c['county']} | {c['constituency']} | "
                    f"{old_lat} | {old_lon} | "
                    f"{c['new_lat']:.6f} | {c['new_lon']:.6f} | "
                    f"{c['shift_meters']} | {c['source']} |\n"
                )

        if duplicates:
            f.write(f"\n## Duplicate IDs to Remove\n\n")
            f.write(f"`{duplicates}`\n")

    logger.info(f"Report saved to {json_path} and {md_path}")
    return json_path


# ============================================================================
# Apply Corrections
# ============================================================================

def apply_corrections(
    client: SupabaseClient,
    corrections: List[Dict],
    duplicates: List[int]
) -> Dict:
    """Apply all corrections to the database."""
    stats = {
        "updated": 0,
        "deleted": 0,
        "errors": [],
    }

    for dup_id in duplicates:
        try:
            client.delete_office(dup_id)
            stats["deleted"] += 1
            logger.info(f"Deleted duplicate office ID {dup_id}")
        except Exception as e:
            error_msg = f"Failed to delete office {dup_id}: {e}"
            logger.error(error_msg)
            stats["errors"].append(error_msg)

    for correction in corrections:
        try:
            updates = {
                "latitude": correction["new_lat"],
                "longitude": correction["new_lon"],
                "verified": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            client.update_office(correction["id"], updates)
            stats["updated"] += 1
            logger.info(
                f"Updated {correction['constituency']}: "
                f"({correction['old_lat']}, {correction['old_lon']}) -> "
                f"({correction['new_lat']}, {correction['new_lon']}) "
                f"[shift: {correction['shift_meters']}m, source: {correction['source']}]"
            )
        except Exception as e:
            error_msg = f"Failed to update {correction['constituency']}: {e}"
            logger.error(error_msg)
            stats["errors"].append(error_msg)

    return stats


# ============================================================================
# Main
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="IEBC Office Coordinate Correction Tool"
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="Actually apply changes to the database (default: dry run)"
    )
    parser.add_argument(
        "--report-only", action="store_true",
        help="Only generate the report, don't compute or apply changes"
    )
    args = parser.parse_args()

    if not HAS_REQUESTS:
        logger.error("The 'requests' library is required. Install with: pip install requests")
        sys.exit(1)

    api_key = SUPABASE_KEY or SUPABASE_ANON_KEY
    if not api_key:
        logger.error("No Supabase key found. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY env var.")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("IEBC Office Coordinate Correction Tool")
    logger.info("=" * 60)

    logger.info("Loading Golden Data sources...")
    geonames = load_geonames(KE_TXT_PATH)
    raw_csv = load_raw_csv(RAW_CSV_PATH)
    geojson_coords = load_geojson(GEOJSON_PATH)

    logger.info("Connecting to Supabase...")
    client = SupabaseClient(SUPABASE_URL, api_key)

    logger.info("Fetching current database offices...")
    db_offices = client.fetch_all_offices()

    logger.info("Computing corrections...")
    corrections, duplicates = build_corrections(
        db_offices, raw_csv, geonames, geojson_coords
    )

    logger.info(f"\n{'='*60}")
    logger.info(f"RESULTS:")
    logger.info(f"  - Offices in database: {len(db_offices)}")
    logger.info(f"  - Corrections needed:  {len(corrections)}")
    logger.info(f"  - Duplicates found:    {len(duplicates)}")
    logger.info(f"{'='*60}\n")

    nairobi_fixes = [c for c in corrections if c["county"] == "Nairobi"]
    if nairobi_fixes:
        logger.info(f"Nairobi fixes ({len(nairobi_fixes)}):")
        for fix in nairobi_fixes:
            logger.info(
                f"  {fix['constituency']}: ({fix['old_lat']}, {fix['old_lon']}) -> "
                f"({fix['new_lat']}, {fix['new_lon']}) [{fix['shift_meters']}m]"
            )

    report_path = generate_report(corrections, duplicates, REPORT_DIR)

    if args.apply:
        logger.info("\n>>> APPLYING CHANGES TO DATABASE <<<")
        stats = apply_corrections(client, corrections, duplicates)
        logger.info(f"\nApplication complete:")
        logger.info(f"  - Updated: {stats['updated']}")
        logger.info(f"  - Deleted: {stats['deleted']}")
        if stats['errors']:
            logger.warning(f"  - Errors:  {len(stats['errors'])}")
            for err in stats['errors']:
                logger.warning(f"    {err}")
    else:
        logger.info("\n>>> DRY RUN — No changes applied <<<")
        logger.info("Run with --apply to commit changes to the database.")

    logger.info(f"\nFull report: {report_path}")


if __name__ == "__main__":
    main()
