"""
dedup_prepass.py — Step 0a

Deduplication Pre-Pass + Coordinate Propagation.

Finds all registration centres sharing the same normalized office_location +
ward + constituency (same physical building). After geocoder_v5 resolves the
first member of each cluster, this script propagates coordinates to all
sibling members, respecting the overwrite policy:
  - If sibling already has google/google_geocoding_v5 verified coords → skip
  - Otherwise → copy from the best resolved sibling

Flags:
  --propagate-only    Skip cluster detection + CSV export; only propagate coords.
                      Use for the second pass AFTER geocoder_v5.ts has run.
  --detect-only       Only detect clusters + export CSV; skip propagation.

Also exports: scraper/dedup_clusters.csv for HITL inspection.
"""
import psycopg2
import os
import re
import csv
import sys
import traceback
from dotenv import load_dotenv

PROPAGATE_ONLY = '--propagate-only' in sys.argv
DETECT_ONLY    = '--detect-only' in sys.argv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

KENYA_LAT_MIN = -4.72
KENYA_LAT_MAX = 4.62
KENYA_LNG_MIN = 33.91
KENYA_LNG_MAX = 41.91

def normalize(s):
    if not s:
        return ""
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9\s]", "", s)
    s = re.sub(r"\s+", " ", s)
    return s

def bbox_valid(lat, lng):
    if lat is None or lng is None:
        return False
    return KENYA_LAT_MIN <= lat <= KENYA_LAT_MAX and KENYA_LNG_MIN <= lng <= KENYA_LNG_MAX

def fetch_and_cluster(cur):
    cur.execute("""
        SELECT id, office_location, ward, constituency, county,
               latitude, longitude, geocode_status, geocode_method
        FROM public.iebc_offices
        WHERE office_type = 'REGISTRATION_CENTRE'
        ORDER BY id ASC
    """)
    rows = cur.fetchall()
    print(f"[DEDUP] Loaded {len(rows)} records.")

    clusters = {}
    for row in rows:
        id_, loc, ward, con, county, lat, lng, g_status, g_method = row
        key = f"{normalize(loc)}|{normalize(ward)}|{normalize(con)}"
        if key not in clusters:
            clusters[key] = []
        clusters[key].append({
            "id": id_, "location": loc, "ward": ward, "constituency": con,
            "county": county, "lat": lat, "lng": lng,
            "geocode_status": g_status, "geocode_method": g_method
        })

    dup_clusters = {k: v for k, v in clusters.items() if len(v) > 1}
    return dup_clusters

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    if PROPAGATE_ONLY:
        print("[DEDUP] --propagate-only: second pass — propagating resolved coords to siblings...")
        dup_clusters = fetch_and_cluster(cur)
        print(f"[DEDUP] Found {len(dup_clusters)} duplicate clusters.")
    else:
        print("[DEDUP] Step 0a: Deduplication Pre-Pass — detecting clusters...")
        dup_clusters = fetch_and_cluster(cur)
        total_in_clusters = sum(len(v) for v in dup_clusters.values())
        print(f"[DEDUP] Found {len(dup_clusters)} duplicate clusters ({total_in_clusters} total records).")

        # Export CSV for HITL inspection
        with open("scraper/dedup_clusters.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["cluster_key", "id", "office_location", "ward", "constituency",
                             "county", "latitude", "longitude", "geocode_status", "geocode_method"])
            for key, members in dup_clusters.items():
                for m in members:
                    writer.writerow([
                        key, m["id"], m["location"], m["ward"], m["constituency"],
                        m["county"], m["lat"], m["lng"], m["geocode_status"], m["geocode_method"]
                    ])
        print("[DEDUP] Exported scraper/dedup_clusters.csv")

    # ── Propagation ────────────────────────────────────────────────────────
    if DETECT_ONLY:
        print("[DEDUP] --detect-only: skipping propagation.")
    else:
        propagated = 0
        skipped = 0
        for key, members in dup_clusters.items():
            # Find best resolved source: prefer Google ROOFTOP/RANGE first
            source = None
            for m in members:
                if (m["lat"] is not None and bbox_valid(m["lat"], m["lng"])
                        and m["geocode_status"] == "verified"
                        and m["geocode_method"] in ("google", "google_geocoding_v5")):
                    source = m
                    break

            # Fall back to any bbox-valid member
            if source is None:
                for m in members:
                    if m["lat"] is not None and bbox_valid(m["lat"], m["lng"]):
                        source = m
                        break

            if source is None:
                skipped += 1
                continue

            for m in members:
                if m["id"] == source["id"]:
                    continue
                # Do NOT overwrite a sibling that already has verified Google coords
                if (m["geocode_method"] in ("google", "google_geocoding_v5")
                        and m["geocode_status"] == "verified"):
                    continue
                # Do NOT overwrite a sibling that has valid bbox coords if source is non-Google
                if (m["lat"] is not None and bbox_valid(m["lat"], m["lng"])
                        and source["geocode_method"] not in ("google", "google_geocoding_v5")):
                    continue

                cur.execute("""
                    UPDATE public.iebc_offices SET
                        latitude = %s,
                        longitude = %s,
                        geocode_method = %s,
                        geocode_status = %s,
                        notes = COALESCE(notes, '') || ' [DEDUP: coords inherited from ID ' || %s || ']',
                        updated_at = NOW()
                    WHERE id = %s
                """, (
                    source["lat"], source["lng"],
                    source["geocode_method"] or "dedup_propagation",
                    source["geocode_status"] or "approximate",
                    str(source["id"]), m["id"]
                ))
                propagated += 1

        print(f"[DEDUP] Propagated coords to {propagated} duplicate members.")
        print(f"[DEDUP] Skipped {skipped} clusters (no resolved source yet).")

    print("[DEDUP] Step 0a complete.")
    conn.close()

except Exception as e:
    print(f"[DEDUP ERROR] {e}")
    traceback.print_exc()
    sys.exit(1)
