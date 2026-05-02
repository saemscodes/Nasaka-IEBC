"""
NASAKA GEOC-v14: Definitive Coordinate Reconciliation Pipeline

Three-phase orchestrator that ensures both iebc_registration_centres and iebc_offices
converge toward 100% coordinate coverage.

Phase 1: Reverse Sync (OF → RC) — Harvest existing geocoder_v5 coordinates
Phase 2: Forward Sync (RC → OF) — Push scraper-verified coordinates to production
Phase 3: Generate clean UUID-free db_ready_coordinates.csv
Phase 4: Validation Report

Usage:
  python scripts/reconcile_coordinates.py                    # Run all phases
  python scripts/reconcile_coordinates.py --phase 1          # Run Phase 1 only
  python scripts/reconcile_coordinates.py --phase 2          # Run Phase 2 only
  python scripts/reconcile_coordinates.py --phase 3          # Run Phase 3 only
  python scripts/reconcile_coordinates.py --report           # Validation report only
"""
import os, csv, re, sys, argparse, psycopg2
from dotenv import load_dotenv

def normalize(text):
    """Collapse multiple spaces, strip, uppercase."""
    if not text: return ""
    return re.sub(r'\s+', ' ', text.strip()).upper()


def phase1_reverse_sync(conn):
    """
    Phase 1: Reverse Sync (OF → RC)
    Harvest existing coordinates from iebc_offices back into iebc_registration_centres.
    Uses space-normalized name+county matching.
    Overwrites ALL RC coordinates — previous coords may have overlapped during transfer.
    """
    cur = conn.cursor()

    print("\n" + "="*60)
    print("  PHASE 1: REVERSE SYNC (iebc_offices → iebc_registration_centres)")
    print("="*60)

    # Pre-count
    cur.execute("SELECT count(*) FROM public.iebc_registration_centres WHERE latitude IS NOT NULL")
    pre_count = cur.fetchone()[0]
    print(f"  RC rows with coords BEFORE sync: {pre_count}")

    cur.execute("""
        UPDATE public.iebc_registration_centres AS rc
        SET latitude = of.latitude,
            longitude = of.longitude,
            geocode_confidence = of.geocode_confidence::float,
            location_source = of.geocode_method,
            location_type = 'REVERSE_SYNC',
            updated_at = NOW()
        FROM public.iebc_offices AS of
        WHERE UPPER(TRIM(REGEXP_REPLACE(rc.name, '\\s+', ' ', 'g')))
            = UPPER(TRIM(REGEXP_REPLACE(of.office_location, '\\s+', ' ', 'g')))
          AND UPPER(TRIM(REGEXP_REPLACE(rc.county, '\\s+', ' ', 'g')))
            = UPPER(TRIM(REGEXP_REPLACE(of.county, '\\s+', ' ', 'g')))
          AND of.latitude IS NOT NULL
          AND of.longitude IS NOT NULL
          AND of.office_type = 'REGISTRATION_CENTRE'
    """)

    synced = cur.rowcount
    conn.commit()

    # Post-count
    cur.execute("SELECT count(*) FROM public.iebc_registration_centres WHERE latitude IS NOT NULL")
    post_count = cur.fetchone()[0]

    print(f"  Rows synced:                     {synced}")
    print(f"  RC rows with coords AFTER sync:  {post_count}")
    print(f"  Net gain:                        +{post_count - pre_count}")
    return synced


def phase2_forward_sync(conn):
    """
    Phase 2: Forward Sync (RC → OF)
    Push coordinates from iebc_registration_centres to iebc_offices.
    Uses space-normalized name+county matching.
    Updates OF rows that currently have NO coordinates OR have lower confidence.
    """
    cur = conn.cursor()

    print("\n" + "="*60)
    print("  PHASE 2: FORWARD SYNC (iebc_registration_centres → iebc_offices)")
    print("="*60)

    # Pre-count
    cur.execute("SELECT count(*) FROM public.iebc_offices WHERE latitude IS NOT NULL AND office_type = 'REGISTRATION_CENTRE'")
    pre_count = cur.fetchone()[0]
    print(f"  OF rows with coords BEFORE sync: {pre_count}")

    # Update OF rows that have NO coordinates
    cur.execute("""
        UPDATE public.iebc_offices AS of
        SET latitude = rc.latitude,
            longitude = rc.longitude,
            geocode_confidence = rc.geocode_confidence,
            geocode_status = 'verified',
            geocode_method = COALESCE(rc.location_source, 'google_maps_scraper_v14'),
            verified = true,
            updated_at = NOW()
        FROM public.iebc_registration_centres AS rc
        WHERE UPPER(TRIM(REGEXP_REPLACE(of.office_location, '\\s+', ' ', 'g')))
            = UPPER(TRIM(REGEXP_REPLACE(rc.name, '\\s+', ' ', 'g')))
          AND UPPER(TRIM(REGEXP_REPLACE(of.county, '\\s+', ' ', 'g')))
            = UPPER(TRIM(REGEXP_REPLACE(rc.county, '\\s+', ' ', 'g')))
          AND of.office_type = 'REGISTRATION_CENTRE'
          AND rc.latitude IS NOT NULL
          AND rc.longitude IS NOT NULL
          AND (of.latitude IS NULL OR of.geocode_confidence IS NULL OR of.geocode_confidence::float < rc.geocode_confidence)
    """)

    synced = cur.rowcount
    conn.commit()

    # Post-count
    cur.execute("SELECT count(*) FROM public.iebc_offices WHERE latitude IS NOT NULL AND office_type = 'REGISTRATION_CENTRE'")
    post_count = cur.fetchone()[0]

    print(f"  Rows synced:                     {synced}")
    print(f"  OF rows with coords AFTER sync:  {post_count}")
    print(f"  Net gain:                        +{post_count - pre_count}")
    return synced


def phase3_generate_csv(conn, output_path):
    """
    Phase 3: Generate clean, UUID-free, human-readable CSV.
    Contains all successfully geocoded centres with attributable facility names.
    """
    cur = conn.cursor()

    print("\n" + "="*60)
    print("  PHASE 3: GENERATING DB-READY CSV (UUID-FREE)")
    print("="*60)

    cur.execute("""
        SELECT rc.name, rc.county, rc.constituency, rc.ward, rc.centre_code,
               rc.latitude, rc.longitude, rc.geocode_confidence, rc.location_source,
               rc.location_type, rc.google_place_id
        FROM public.iebc_registration_centres rc
        WHERE rc.latitude IS NOT NULL AND rc.longitude IS NOT NULL
        ORDER BY rc.county, rc.constituency, rc.name
    """)
    rows = cur.fetchall()

    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['NAME', 'COUNTY', 'CONSTITUENCY', 'WARD', 'CENTRE_CODE',
                         'LAT', 'LNG', 'CONFIDENCE', 'SOURCE', 'TYPE', 'GOOGLE_URL'])
        for r in rows:
            writer.writerow(r)

    print(f"  Wrote {len(rows)} verified coordinates to {output_path}")
    print(f"  Format: NAME, COUNTY, CONSTITUENCY, WARD, CENTRE_CODE, LAT, LNG, CONFIDENCE, SOURCE, TYPE, GOOGLE_URL")
    return len(rows)


def validation_report(conn):
    """Full validation report across both tables."""
    cur = conn.cursor()

    print("\n" + "="*60)
    print("  NASAKA GEOC-v14 VALIDATION REPORT")
    print("="*60)

    # RC stats
    cur.execute("SELECT count(*) FROM public.iebc_registration_centres")
    rc_total = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM public.iebc_registration_centres WHERE latitude IS NOT NULL")
    rc_coords = cur.fetchone()[0]

    print(f"\n  iebc_registration_centres:")
    print(f"    Total:          {rc_total}")
    print(f"    With coords:    {rc_coords}")
    print(f"    Without coords: {rc_total - rc_coords}")
    print(f"    Coverage:       {100*rc_coords/rc_total:.1f}%")

    # RC by source
    cur.execute("""
        SELECT COALESCE(location_source, 'NULL'), count(*) 
        FROM public.iebc_registration_centres 
        WHERE latitude IS NOT NULL
        GROUP BY location_source ORDER BY count(*) DESC
    """)
    print(f"    By source:")
    for r in cur.fetchall():
        print(f"      {r[0]}: {r[1]}")

    # OF stats
    cur.execute("SELECT count(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'")
    of_total = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE' AND latitude IS NOT NULL")
    of_coords = cur.fetchone()[0]

    print(f"\n  iebc_offices (REGISTRATION_CENTRE):")
    print(f"    Total:          {of_total}")
    print(f"    With coords:    {of_coords}")
    print(f"    Without coords: {of_total - of_coords}")
    print(f"    Coverage:       {100*of_coords/of_total:.1f}%")

    # OF by status
    cur.execute("""
        SELECT COALESCE(geocode_status, 'NULL'), count(*) 
        FROM public.iebc_offices 
        WHERE office_type = 'REGISTRATION_CENTRE'
        GROUP BY geocode_status ORDER BY count(*) DESC
    """)
    print(f"    By status:")
    for r in cur.fetchall():
        print(f"      {r[0]}: {r[1]}")

    # OF by method
    cur.execute("""
        SELECT COALESCE(geocode_method, 'NULL'), count(*) 
        FROM public.iebc_offices 
        WHERE office_type = 'REGISTRATION_CENTRE' AND latitude IS NOT NULL
        GROUP BY geocode_method ORDER BY count(*) DESC
    """)
    print(f"    By method:")
    for r in cur.fetchall():
        print(f"      {r[0]}: {r[1]}")

    # Cross-table match stats
    cur.execute("""
        SELECT count(DISTINCT rc.id) 
        FROM public.iebc_registration_centres rc
        JOIN public.iebc_offices of 
            ON UPPER(TRIM(REGEXP_REPLACE(rc.name, '\\s+', ' ', 'g'))) = UPPER(TRIM(REGEXP_REPLACE(of.office_location, '\\s+', ' ', 'g')))
            AND UPPER(TRIM(REGEXP_REPLACE(rc.county, '\\s+', ' ', 'g'))) = UPPER(TRIM(REGEXP_REPLACE(of.county, '\\s+', ' ', 'g')))
        WHERE of.office_type = 'REGISTRATION_CENTRE'
    """)
    cross_match = cur.fetchone()[0]

    cur.execute("""
        SELECT count(DISTINCT rc.id) 
        FROM public.iebc_registration_centres rc
        LEFT JOIN public.iebc_offices of 
            ON UPPER(TRIM(REGEXP_REPLACE(rc.name, '\\s+', ' ', 'g'))) = UPPER(TRIM(REGEXP_REPLACE(of.office_location, '\\s+', ' ', 'g')))
            AND UPPER(TRIM(REGEXP_REPLACE(of.county, '\\s+', ' ', 'g'))) = UPPER(TRIM(REGEXP_REPLACE(rc.county, '\\s+', ' ', 'g')))
        WHERE of.id IS NULL
    """)
    rc_orphans = cur.fetchone()[0]

    print(f"\n  Cross-table reconciliation:")
    print(f"    RC→OF matches (name+county): {cross_match}")
    print(f"    RC orphans (no OF match):    {rc_orphans}")
    print(f"    Match rate:                  {100*cross_match/rc_total:.1f}%")

    print("\n" + "="*60)


def main():
    parser = argparse.ArgumentParser(description='GEOC-v14 Coordinate Reconciliation Pipeline')
    parser.add_argument('--phase', type=int, choices=[1, 2, 3], help='Run a specific phase only')
    parser.add_argument('--report', action='store_true', help='Run validation report only')
    parser.add_argument('--output', default='data/db_ready_coordinates.csv', help='Output CSV path')
    args = parser.parse_args()

    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    if not db_url:
        print("[FATAL] SUPABASE_DB_POOLED_URL missing")
        sys.exit(1)

    conn = psycopg2.connect(db_url)

    print("="*60)
    print("  NASAKA GEOC-v14 COORDINATE RECONCILIATION PIPELINE")
    print("="*60)

    if args.report:
        validation_report(conn)
        conn.close()
        return

    if args.phase == 1 or args.phase is None:
        phase1_reverse_sync(conn)

    if args.phase == 2 or args.phase is None:
        phase2_forward_sync(conn)

    if args.phase == 3 or args.phase is None:
        phase3_generate_csv(conn, args.output)

    validation_report(conn)
    conn.close()
    print("\nPipeline complete.")


if __name__ == "__main__":
    main()
