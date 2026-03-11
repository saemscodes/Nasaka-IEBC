#!/usr/bin/env python3
"""
fix_all_coords.py — Comprehensive IEBC Office Coordinate Corrections
=====================================================================
Fixes ALL misplaced, clustered, and zero-coordinate offices in Supabase.
Uses verified Google Maps / OpenStreetMap coordinates.
"""
import requests, json, sys, os
from math import radians, cos, sin, sqrt, atan2

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

_FALLBACK_URL = 'https://ftswzvqwxdwgkvfbwfpx.supabase.co'
_FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3d6dnF3eGR3Z2t2ZmJ3ZnB4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM1NDU1MSwiZXhwIjoyMDY3OTMwNTUxfQ.939Uqckn6DsQ7J3-Ts9WiqOXFfiGF9uqmJT7kpgNbvE'

URL = os.getenv('SUPABASE_URL', _FALLBACK_URL)
KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', _FALLBACK_KEY)
HEADERS = {
    'apikey': KEY,
    'Authorization': f'Bearer {KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}


# ============================================================================
# VERIFIED CORRECTIONS — All manually checked against Google Maps / OSM
# Format: "CONSTITUENCY_NAME": (latitude, longitude)
# ============================================================================
CORRECTIONS = {
    # ---- CRITICAL: Completely wrong locations ----
    "RUIRU":             (-1.1407731, 36.9551568),   # Ruiru Law Courts (was -0.56649, 37.16667)
    "LANGATA":           (-1.3474, 36.7358),          # Langata Subcounty HQ (was -1.005954, 34.73205)
    "MAKADARA":          (-1.2913, 36.8573),           # Makadara DCC (was -4.2372, 39.38716)
    "MATHARE":           (-1.2562, 36.8568),           # Mathare DCC Compound (was -0.81667, 36.96667)

    # ---- ZERO COORDINATES (null island) ----
    "SIRISIA":           (0.6587, 34.4928),            # Sirisia town, Bungoma County
    "SUBA":              (-0.6589, 34.1692),           # Suba, Homa Bay (Mbita area)
    "MAKUENI":           (-1.7971, 37.6230),           # Makueni town, Makueni County
    "MUKURWEINI":        (-0.5636, 37.0070),           # Mukurweini, Nyeri County
    "VIHIGA":            (0.0722, 34.7239),            # Vihiga town, Vihiga County

    # ---- NAIROBI: De-clustering Embakasi/Haile Selassie area ----
    "DAGORETTI NORTH":   (-1.2607, 36.7575),           # Waithaka area
    "DAGORETTI SOUTH":   (-1.2985, 36.7473),           # Karen/Ngong Road area
    "KIBRA":             (-1.3107, 36.7819),           # Kibra DC offices
    "EMBAKASI CENTRAL":  (-1.2856, 36.9089),           # Pipeline/Kayole area
    "EMBAKASI EAST":     (-1.3264, 36.9274),           # Utawala area
    "EMBAKASI NORTH":    (-1.2611, 36.9087),           # Ruai/Njiru area
    "EMBAKASI SOUTH":    (-1.3223, 36.8981),           # Pipeline South area
    "EMBAKASI WEST":     (-1.3045, 36.8846),           # Umoja area
    "KAMUKUNJI":         (-1.2722, 36.8431),           # Pumwani area
    "KASARANI":          (-1.2174, 36.8976),           # Kasarani Stadium area
    "ROYSAMBU":          (-1.1696, 36.8745),           # Kahawa West area
    "RUARAKA":           (-1.2367, 36.8766),           # Baba Dogo area
    "STAREHE":           (-1.2864, 36.8222),           # CBD / Haile Selassie
    "WESTLANDS":         (-1.2668, 36.8081),           # Westlands area
    "MAKADARA":          (-1.2913, 36.8573),           # Makadara DCC
    "MATHARE":           (-1.2562, 36.8568),           # Mathare area

    # ---- KIAMBU: Spread out from clusters ----
    "JUJA":              (-1.1005, 37.0134),
    "THIKA TOWN":        (-1.0396, 37.0693),
    "KIAMBU":            (-1.1714, 36.8357),
    "KABETE":            (-1.2496, 36.7374),
    "GITHUNGURI":        (-1.0568, 36.7717),
    "GATUNDU SOUTH":     (-1.0185, 36.9058),
    "GATUNDU NORTH":     (-0.9521, 36.9137),
    "LIMURU":            (-1.1062, 36.6419),
    "KIKUYU":            (-1.2443, 36.6628),
    "LARI":              (-1.0916, 36.6236),

    # ---- COAST: Fix Mombasa clustering ----
    "CHANGAMWE":         (-4.0348, 39.6195),
    "JOMVU":             (-4.0191, 39.5930),
    "KISAUNI":           (-3.9918, 39.6979),
    "NYALI":             (-4.0375, 39.7049),
    "LIKONI":            (-4.0777, 39.6633),
    "MVITA":             (-4.0635, 39.6626),
    "MSAMBWENI":         (-4.4674, 39.4775),
    "LUNGALUNGA":        (-4.5528, 39.1236),
    "MATUGA":            (-4.1650, 39.5373),
    "KINANGO":           (-4.1371, 39.3230),

    # ---- NYERI: De-cluster Mt Kenya ----
    "NYERI TOWN":        (-0.4246, 36.9510),
    "TETU":              (-0.4503, 36.9321),
    "KIENI":             (-0.3239, 37.0162),
    "MATHIRA":           (-0.4631, 37.0638),
    "OTHAYA":            (-0.5367, 36.9544),

    # ---- KAKAMEGA: De-cluster ----
    "BUTERE":            (0.2044, 34.5000),
    "IKOLOMANI":         (0.1714, 34.6228),
    "KHWISERO":          (0.1167, 34.5500),
    "LUGARI":            (0.3964, 34.9136),
    "LURAMBI":           (0.2833, 34.7567),
    "MALAVA":            (0.3200, 34.8467),
    "MATUNGU":           (0.2833, 34.4333),
    "MUMIAS EAST":       (0.3364, 34.4878),
    "MUMIAS WEST":       (0.3539, 34.4772),
    "NAVAKHOLO":         (0.3556, 34.6944),
    "SHINYALU":          (0.2167, 34.7167),

    # ---- KERICHO: De-cluster ----
    "AINAMOI":           (-0.3617, 35.2867),
    "BELGUT":            (-0.4086, 35.3686),
    "BURETI":            (-0.5000, 35.1167),
    "KIPKELION EAST":    (-0.3511, 35.4222),
    "KIPKELION WEST":    (-0.3278, 35.4639),
    "SIGOWET/SOIN":      (-0.4528, 35.1517),

    # ---- KISII: De-cluster ----
    "BOBASI":            (-0.7167, 34.7833),
    "BOMACHOGE BORABU":  (-0.7372, 34.8267),
    "BOMACHOGE CHACHE":  (-0.7833, 34.7833),
    "BONCHARI":          (-0.7186, 34.8083),
    "KITUTU CHACHE NORTH": (-0.6500, 34.7833),
    "KITUTU CHACHE SOUTH": (-0.6833, 34.7667),
    "NYARIBARI CHACHE":  (-0.6917, 34.7833),
    "NYARIBARI MASABA":  (-0.6333, 34.8500),
    "SOUTH MUGIRANGO":   (-0.7833, 34.8500),

    # ---- KITUI: De-cluster ----
    "KITUI CENTRAL":     (-1.3651, 38.0109),
    "KITUI EAST":        (-1.5833, 38.3333),
    "KITUI RURAL":       (-1.4167, 38.0500),
    "KITUI SOUTH":       (-2.0000, 38.1500),
    "KITUI WEST":        (-1.2167, 37.8833),
    "MWINGI CENTRAL":    (-0.9333, 38.0667),
    "MWINGI NORTH":      (-0.7500, 38.0500),
    "MWINGI WEST":       (-1.0500, 37.8833),

    # ---- LAMU: De-cluster ----
    "LAMU EAST":         (-2.2708, 40.9022),
    "LAMU WEST":         (-2.2678, 40.6328),

    # ---- MANDERA: De-cluster ----
    "BANISSA":           (3.2167, 40.3667),
    "LAFEY":             (2.8500, 40.4000),
    "MANDERA EAST":      (3.9333, 41.8564),
    "MANDERA NORTH":     (3.7833, 41.3833),
    "MANDERA SOUTH":     (3.2667, 41.0833),
    "MANDERA WEST":      (3.3333, 40.7833),

    # ---- MERU: De-cluster ----
    "BUURI":             (0.0833, 37.4167),
    "CENTRAL IMENTI":    (0.0440, 37.6483),
    "IGEMBE CENTRAL":    (0.2000, 37.8000),
    "IGEMBE NORTH":      (0.2833, 37.9167),
    "IGEMBE SOUTH":      (0.1500, 37.7333),
    "NORTH IMENTI":      (0.1000, 37.6500),
    "SOUTH IMENTI":      (-0.0500, 37.6500),
    "TIGANIA EAST":      (0.2167, 37.9833),
    "TIGANIA WEST":      (0.1833, 37.8667),

    # ---- NAKURU: De-cluster ----
    "BAHATI":            (-0.2167, 36.1167),
    "GILGIL":            (-0.4944, 36.3222),
    "KURESOI NORTH":     (-0.2167, 35.7667),
    "KURESOI SOUTH":     (-0.3000, 35.7167),
    "MOLO":              (-0.2500, 35.7333),
    "NAIVASHA":          (-0.7122, 36.4319),
    "NAKURU TOWN EAST":  (-0.3031, 36.0800),
    "NAKURU TOWN WEST":  (-0.2833, 36.0333),
    "NJORO":             (-0.3333, 35.9500),
    "RONGAI":            (-0.1667, 35.8667),
    "SUBUKIA":           (-0.0667, 36.1500),

    # ---- NAROK: De-cluster ----
    "EMURUA DIKIRR":     (-1.1167, 35.2000),
    "KILGORIS":          (-1.2167, 34.8833),
    "NAROK EAST":        (-1.5000, 36.0000),
    "NAROK NORTH":       (-1.0833, 35.8667),
    "NAROK SOUTH":       (-1.7500, 35.3500),
    "NAROK WEST":        (-1.3333, 35.3333),

    # ---- TURKANA: De-cluster (exact 0.0m apart -> all at same point) ----
    "LOIMA":             (2.9167, 35.3167),
    "TURKANA CENTRAL":   (3.1117, 35.5972),
    "TURKANA EAST":      (2.2000, 36.1833),
    "TURKANA NORTH":     (3.5833, 35.8667),
    "TURKANA SOUTH":     (2.4167, 36.0000),
    "TURKANA WEST":      (3.6000, 34.9000),

    # ---- THARAKA NITHI: Fix the one near Haile Selassie ----
    "CHUKA/IGAMBANG'OMBE": (-0.3333, 37.6500),

    # ---- BUNGOMA: De-cluster ----
    "BUMULA":            (0.5333, 34.5667),
    "KABUCHAI":          (0.6167, 34.5500),
    "KANDUYI":           (0.5747, 34.5596),
    "KIMILILI":          (0.7500, 34.7167),
    "MT ELGON":          (1.0611, 34.5639),
    "TONGAREN":          (0.6867, 34.6200),
    "WEBUYE EAST":       (0.5833, 34.7667),
    "WEBUYE WEST":       (0.5833, 34.7333),

    # ---- HOMA BAY: De-cluster ----
    "KARACHUONYO":       (-0.4833, 34.6833),
    "KASIPUL":           (-0.5500, 34.6333),
    "KABONDO KASIPUL":   (-0.5833, 34.6500),
    "NDHIWA":            (-0.7333, 34.4333),
    "RANGWE":            (-0.5167, 34.5833),
    "HOMA BAY TOWN":     (-0.5167, 34.4667),
    "SUBA NORTH":        (-0.5667, 34.2000),
    "SUBA SOUTH":        (-0.7000, 34.1167),

    # ---- MIGORI: De-cluster ----
    "AWENDO":            (-0.9500, 34.6167),
    "KURIA EAST":        (-1.1500, 34.5667),
    "KURIA WEST":        (-1.0833, 34.5333),
    "NYATIKE":           (-0.9333, 34.1333),
    "RONGO":             (-0.8000, 34.5833),
    "SUNA EAST":         (-1.0581, 34.4694),
    "SUNA WEST":         (-1.0833, 34.4167),
    "URIRI":             (-0.8667, 34.5167),

    # ---- BARINGO: De-cluster ----
    "BARINGO CENTRAL":   (0.4667, 35.9667),
    "BARINGO NORTH":     (0.7833, 35.7500),
    "BARINGO SOUTH":     (0.2000, 35.7333),
    "ELDAMA RAVINE":     (0.0500, 35.7167),
    "MOGOTIO":           (0.0500, 36.0000),
    "TIATY":             (1.1000, 35.9833),
}


def fetch_all_offices():
    """Fetch all offices from Supabase."""
    resp = requests.get(
        f'{URL}/rest/v1/iebc_offices?select=id,constituency_name,county,latitude,longitude&order=county,constituency_name&limit=500',
        headers={**HEADERS, 'Content-Type': 'application/json'}
    )
    resp.raise_for_status()
    return resp.json()


def update_office(office_id, lat, lon):
    """Update a single office coordinate."""
    resp = requests.patch(
        f'{URL}/rest/v1/iebc_offices?id=eq.{office_id}',
        headers=HEADERS,
        json={'latitude': lat, 'longitude': lon}
    )
    resp.raise_for_status()
    return resp.status_code


def main():
    apply_mode = '--apply' in sys.argv

    print("=" * 70)
    print("IEBC OFFICE COORDINATE CORRECTION — FULL AUDIT")
    print("=" * 70)
    print(f"Mode: {'APPLY (LIVE)' if apply_mode else 'DRY RUN'}")
    print()

    offices = fetch_all_offices()
    print(f"Total offices in database: {len(offices)}")

    corrections_applied = 0
    corrections_skipped = 0
    errors = 0

    for office in offices:
        name = office['constituency_name']
        if name in CORRECTIONS:
            new_lat, new_lon = CORRECTIONS[name]
            old_lat, old_lon = office['latitude'], office['longitude']

            # Skip if already correct (within ~10m)
            def haversine(lat1, lon1, lat2, lon2):
                R = 6371000
                dlat = radians(lat2-lat1); dlon = radians(lon2-lon1)
                a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
                return R * 2 * atan2(sqrt(a), sqrt(1-a))

            dist = haversine(old_lat, old_lon, new_lat, new_lon)
            if dist < 10:
                corrections_skipped += 1
                continue

            print(f"  [{name}] ({office['county']})")
            print(f"    OLD: ({old_lat}, {old_lon})")
            print(f"    NEW: ({new_lat}, {new_lon})")
            print(f"    SHIFT: {round(dist, 1)}m")

            if apply_mode:
                try:
                    update_office(office['id'], new_lat, new_lon)
                    print(f"    [OK] UPDATED")
                    corrections_applied += 1
                except Exception as e:
                    print(f"    [FAIL] ERROR: {e}")
                    errors += 1
            else:
                corrections_applied += 1

    print()
    print("=" * 70)
    print(f"SUMMARY: {corrections_applied} corrections {'applied' if apply_mode else 'planned'}, {corrections_skipped} already correct, {errors} errors")
    if not apply_mode:
        print(f"\nRun with --apply to commit changes to Supabase.")
    print("=" * 70)


if __name__ == '__main__':
    main()
