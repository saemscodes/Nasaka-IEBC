import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("=== 30-COLUMN COVERAGE AUDIT (STRICT MODE) ===\n")

    COL_CHECKS = [
        ("distance_from_landmark", "distance_from_landmark"),
        ("direction_type", "direction_type"),
        ("direction_landmark", "direction_landmark"),
        ("landmark_type", "landmark_type"),
        ("landmark_subtype", "landmark_subtype"),
        ("latitude", "latitude"),
        ("longitude", "longitude"),
        ("geocode_method", "geocode_method"),
        ("geocode_confidence", "geocode_confidence"),
        ("accuracy_meters", "accuracy_meters"),
        ("formatted_address", "formatted_address"),
        ("geocode_status", "geocode_status"),
        ("source", "source"),
        ("verified", "verified"),
        ("notes", "notes"),
        ("result_type", "result_type"),
        ("geom", "geom"),
        ("elevation_meters", "elevation_meters"),
        ("isochrone_15min", "isochrone_15min"),
        ("isochrone_30min", "isochrone_30min"),
        ("isochrone_45min", "isochrone_45min"),
        ("walking_effort", "walking_effort"),
        ("geocode_verified", "geocode_verified"),
        ("geocode_verified_at", "geocode_verified_at"),
        ("ward", "ward"),
        ("ward_id", "ward_id"),
        ("county_code", "county_code"),
        ("ward_code", "ward_code"),
        ("centre_code", "centre_code"),
        ("caw_code", "caw_code"),
    ]

    print(f"{'Col':<30} {'Non-NULL':>10} {'NULL':>10} {'Coverage':>10}")
    print("-" * 65)

    for label, col in COL_CHECKS:
        try:
            cur.execute(f"""
                SELECT 
                    COUNT(*) FILTER (WHERE {col} IS NOT NULL),
                    COUNT(*) FILTER (WHERE {col} IS NULL)
                FROM public.iebc_offices
                WHERE office_type = 'REGISTRATION_CENTRE'
            """)
            row = cur.fetchone()
            non_null, null = row[0], row[1]
            total = non_null + null
            pct = f"{100*non_null/total:.1f}%" if total > 0 else "N/A"
            status = "✔" if null == 0 else ("~" if non_null > 0 else "✗")
            print(f"{status} {label:<28} {non_null:>10,} {null:>10,} {pct:>10}")
        except Exception as ce:
            print(f"? {label:<28} ERROR: {ce}")

    conn.close()
except Exception as e:
    print(f"AUDIT ERROR: {e}")
