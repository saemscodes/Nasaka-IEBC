#!/usr/bin/env python3
"""
verify_scraped_coordinates.py
Evaluates verifiability of Google Maps scraped coordinates.
Outputs deduplicated, database‑ready CSV.
"""

import csv
import json
import math
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from shapely.geometry import Point, shape

KE_LAT_MIN, KE_LAT_MAX = -4.72, 4.62
KE_LNG_MIN, KE_LNG_MAX = 33.91, 41.91

def load_ward_boundaries(geojson_path: str) -> Dict[str, shape]:
    if not Path(geojson_path).exists():
        print(f"Warning: GeoJSON not found at {geojson_path}. Spatial checks will be disabled.")
        return {}
    with open(geojson_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    boundaries = {}
    for feat in data['features']:
        ward = feat['properties'].get('ward', '').upper().strip()
        county = feat['properties'].get('county', '').upper().strip()
        if ward and county:
            key = f"{ward}|{county}"
            boundaries[key] = shape(feat['geometry'])
    return boundaries

def normalize_county(county: str) -> str:
    return county.upper().replace('/', '-').replace(' COUNTY', '').strip()

def in_kenya_bbox(lat: float, lng: float) -> bool:
    return KE_LAT_MIN <= lat <= KE_LAT_MAX and KE_LNG_MIN <= lng <= KE_LNG_MAX

def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

def extract_place_name_from_url(url: str) -> Optional[str]:
    match = re.search(r'/place/([^/@]+)', url)
    if match:
        return match.group(1).replace('+', ' ').upper()
    return None

def fuzzy_match(query: str, place_name: str) -> bool:
    q_tokens = set(query.upper().split())
    p_tokens = set(place_name.upper().split())
    common = q_tokens & p_tokens
    return len(common) >= min(2, len(q_tokens)//2)

def score_row(row: Dict, ward_boundaries: Dict) -> Tuple[str, float, str]:
    try:
        lat = float(row['LAT']) if row.get('LAT') else None
        lng = float(row['LNG']) if row.get('LNG') else None
    except:
        lat = lng = None
        
    url = row.get('MAPS_URL', '')
    query = row.get('QUERY', '')
    ward = row.get('WARD', '').upper().strip()
    county = normalize_county(row.get('COUNTY', ''))
    key = f"{ward}|{county}"

    if not lat or not lng:
        return "INVALID", 0.0, "Missing coordinates"
    if not in_kenya_bbox(lat, lng):
        return "INVALID", 0.0, "Outside Kenya bounding box"

    is_place = '/place/' in url
    place_name = extract_place_name_from_url(url) if is_place else None
    name_match = fuzzy_match(query, place_name) if place_name else False

    polygon = ward_boundaries.get(key)
    distance_km = 0.0
    if polygon:
        point = Point(lng, lat)
        if not polygon.contains(point):
            centroid = polygon.centroid
            distance_km = haversine_distance(lat, lng, centroid.y, centroid.x)

    if is_place and name_match and distance_km < 5:
        conf = 1.0
        level = "HIGH"
        reason = "Place page, name match, within 5km of ward centroid"
    elif is_place and (name_match or distance_km < 15):
        conf = 0.8
        level = "MEDIUM"
        reason = "Place page, within 15km or name match"
    elif distance_km < 15:
        conf = 0.6
        level = "MEDIUM"
        reason = "Within 15km of ward centroid"
    else:
        conf = 0.3
        level = "LOW"
        reason = f"Distance {distance_km:.1f}km from ward centroid"

    return level, conf, reason

def deduplicate_rows(rows: List[Dict]) -> List[Dict]:
    """Keep only the best row per ID based on verifiability tier and confidence."""
    tier_rank = {'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'INVALID': 0}
    best_map = {}
    for row in rows:
        id_ = row['ID']
        tier = row.get('VERIFIABILITY', '')
        conf = float(row.get('CONFIDENCE_SCORE', 0))
        success = row.get('SUCCESS', '').lower() == 'true'
        if id_ not in best_map:
            best_map[id_] = row
            continue
        existing = best_map[id_]
        e_tier = existing.get('VERIFIABILITY', '')
        e_conf = float(existing.get('CONFIDENCE_SCORE', 0))
        e_success = existing.get('SUCCESS', '').lower() == 'true'
        r_rank = tier_rank.get(tier, 0)
        e_rank = tier_rank.get(e_tier, 0)
        if r_rank > e_rank or (r_rank == e_rank and conf > e_conf) or (r_rank == e_rank and conf == e_conf and success and not e_success):
            best_map[id_] = row
    return list(best_map.values())

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('input_csv', help='Path to scraped CSV')
    parser.add_argument('--geojson', default='android/app/src/main/assets/public/context/Wards/kenya_wards.geojson')
    parser.add_argument('--output', default='data/verified_scraped_coordinates.csv')
    parser.add_argument('--db-ready', default='data/db_ready_coordinates.csv')
    args = parser.parse_args()

    boundaries = load_ward_boundaries(args.geojson)
    print(f"Loaded {len(boundaries)} ward boundaries.")

    rows = []
    if not Path(args.input_csv).exists():
        print(f"Error: Scraped CSV not found at {args.input_csv}")
        return

    with open(args.input_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row.get('LAT') or not row.get('LNG'):
                continue
            level, conf, reason = score_row(row, boundaries)
            row['CONFIDENCE_SCORE'] = f"{conf:.2f}"
            row['VERIFIABILITY'] = level
            row['REASON'] = reason
            rows.append(row)

    if not rows:
        print("No valid rows to deduplicate.")
        return

    deduped = deduplicate_rows(rows)
    print(f"Total rows scored: {len(rows)}, after deduplication: {len(deduped)}")

    fieldnames = list(deduped[0].keys())
    with open(args.output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(deduped)

    high = [r for r in deduped if r['VERIFIABILITY'] == 'HIGH']
    med = [r for r in deduped if r['VERIFIABILITY'] == 'MEDIUM']
    print(f"Verification summary: HIGH={len(high)} MEDIUM={len(med)} LOW/INVALID filtered out.")
    print(f"Full output written to {args.output}")

    # Create database-ready CSV with only HIGH confidence rows
    db_fields = ['ID', 'LAT', 'LNG', 'MAPS_URL', 'VERIFIABILITY', 'CONFIDENCE_SCORE', 'SCREENSHOT_ID']
    with open(args.db_ready, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=db_fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(high)
    print(f"Database-ready HIGH confidence rows written to {args.db_ready}")

if __name__ == '__main__':
    main()
