"""
finalize_geocode.py — Step 6

Post-Pipeline Finalizer.

Sets geocode_verified = true and geocode_verified_at = NOW() ONLY for records that
meet ALL of:
  - geocode_status = 'verified' (ROOFTOP or RANGE_INTERPOLATED only)
  - latitude IS NOT NULL AND longitude IS NOT NULL
  - Coordinates pass Kenya bounding box check
  - elevation_meters IS NOT NULL (proves elevation pass completed)

Also exports:
  - scraper/hitl_geocode.csv: all records with geocode_status IN ('hitl_review', 'out_of_bounds', 'failed')
  - Final production audit counts for all 30 columns
"""
import psycopg2
import os
import csv
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

KENYA_LAT_MIN = -4.72
KENYA_LAT_MAX = 4.62
KENYA_LNG_MIN = 33.91
KENYA_LNG_MAX = 41.91

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()

    print("=== FINALIZE GEOCODE — Step 6 ===\n")

    # Set geocode_verified = true ONLY for verified + bbox + elevation confirmed records
    # geocode_verified=true means: coordinate is ROOFTOP/RANGE AND elevation confirmed AND bbox valid
    cur.execute(f"""
        UPDATE public.iebc_offices
        SET geocode_verified = true,
            geocode_verified_at = NOW(),
            updated_at = NOW()
        WHERE office_type = 'REGISTRATION_CENTRE'
          AND geocode_status = 'verified'
          AND latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND latitude BETWEEN {KENYA_LAT_MIN} AND {KENYA_LAT_MAX}
          AND longitude BETWEEN {KENYA_LNG_MIN} AND {KENYA_LNG_MAX}
          AND elevation_meters IS NOT NULL
          AND geocode_verified = false
    """)
    print(f"[FINALIZE] geocode_verified=true set for {cur.rowcount} records.")

    # Export HITL CSV for manual review
    cur.execute("""
        SELECT id, office_location, ward, constituency, county,
               geocode_status, latitude, longitude, geocode_method,
               geocode_confidence, formatted_address
        FROM public.iebc_offices
        WHERE office_type = 'REGISTRATION_CENTRE'
          AND geocode_status IN ('hitl_review', 'out_of_bounds', 'failed', 'pending')
        ORDER BY geocode_status, county, constituency
    """)
    hitl_rows = cur.fetchall()

    if hitl_rows:
        with open("scraper/hitl_geocode.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["id", "office_location", "ward", "constituency", "county",
                             "geocode_status", "latitude", "longitude", "geocode_method",
                             "geocode_confidence", "formatted_address"])
            for row in hitl_rows:
                writer.writerow(row)
        print(f"[FINALIZE] HITL export: {len(hitl_rows)} records -> scraper/hitl_geocode.csv")
    else:
        print("[FINALIZE] Zero HITL/failed records: 100% geocodes resolved.")

    # Final 30-column production audit
    COLS = [
        "distance_from_landmark", "direction_type", "direction_landmark",
        "landmark_type", "landmark_subtype", "latitude", "longitude",
        "geocode_method", "geocode_confidence", "accuracy_meters",
        "formatted_address", "geocode_status", "source", "verified",
        "notes", "result_type", "geom", "elevation_meters",
        "isochrone_15min", "isochrone_30min", "isochrone_45min",
        "walking_effort", "geocode_verified", "geocode_verified_at",
        "ward", "ward_id", "county_code", "ward_code", "centre_code", "caw_code"
    ]

    print("\n=== FINAL 30-COLUMN PRODUCTION AUDIT ===")
    print(f"{'#':<3} {'Column':<30} {'Non-NULL':>10} {'NULL':>10} {'Coverage':>10}")
    print("-" * 68)

    for i, col in enumerate(COLS, 1):
        try:
            cur.execute(f"""
                SELECT
                    COUNT(*) FILTER (WHERE {col} IS NOT NULL),
                    COUNT(*) FILTER (WHERE {col} IS NULL)
                FROM public.iebc_offices
                WHERE office_type = 'REGISTRATION_CENTRE'
            """)
            non_null, null = cur.fetchone()
            total = non_null + null
            pct = f"{100*non_null/total:.1f}%" if total > 0 else "N/A"
            print(f"{i:<3} {col:<30} {non_null:>10,} {null:>10,} {pct:>10}")
        except Exception as ce:
            print(f"{i:<3} {col:<30} {'ERROR':>10} {str(ce)[:30]}")

    # Geocode status breakdown
    cur.execute("""
        SELECT geocode_status, COUNT(*) as cnt
        FROM public.iebc_offices
        WHERE office_type = 'REGISTRATION_CENTRE'
        GROUP BY geocode_status
        ORDER BY cnt DESC
    """)
    status_rows = cur.fetchall()
    print("\n=== GEOCODE STATUS BREAKDOWN ===")
    for row in status_rows:
        print(f"  {row[0] or 'NULL':<25} {row[1]:>8,}")

    conn.close()
    print("\n[FINALIZE] Step 6 complete.")

except Exception as e:
    print(f"[FINALIZE ERROR] {e}")
    import traceback
    traceback.print_exc()
