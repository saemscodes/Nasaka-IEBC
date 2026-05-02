"""
NASAKA GEOC-v14: Fuzzy Orphan Reconciliation

Resolves the 5,606 RC orphans that have no exact name+county match in iebc_offices.
Uses PostgreSQL's pg_trgm extension for trigram-based fuzzy matching.

Strategy:
  1. Enable pg_trgm extension (if not already enabled)
  2. For each RC orphan (no exact OF match), find the best fuzzy match in OF
     using SIMILARITY() on normalized names within the SAME county
  3. Accept matches above 0.4 similarity threshold
  4. Update the OF row's coordinates from the matched RC row
  5. Generate a report of matched, unmatched, and low-confidence matches

Usage:
  python scripts/fuzzy_orphan_reconciler.py                # Full run
  python scripts/fuzzy_orphan_reconciler.py --dry-run      # Report only, no writes
  python scripts/fuzzy_orphan_reconciler.py --threshold 0.5 # Custom similarity threshold
"""
import os, sys, re, csv, argparse, psycopg2
from dotenv import load_dotenv


def normalize(text):
    """Collapse whitespace, strip, uppercase."""
    if not text: return ""
    return re.sub(r'\s+', ' ', text.strip()).upper()


def make_connection(db_url):
    """Create a new psycopg2 connection with keepalive options."""
    conn = psycopg2.connect(db_url, keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=5)
    conn.autocommit = False
    return conn


def resilient_query(conn_holder, db_url, cur_holder, query, params=None, max_retries=3):
    """Execute a query with auto-reconnect on connection drops."""
    import time
    for attempt in range(1, max_retries + 1):
        try:
            cur_holder[0].execute(query, params)
            return cur_holder[0]
        except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
            if attempt >= max_retries:
                raise
            print(f"        [PG-RECONNECT] Connection lost (attempt {attempt}/{max_retries}): {e}")
            time.sleep(attempt * 2)
            try:
                conn_holder[0].close()
            except:
                pass
            conn_holder[0] = make_connection(db_url)
            cur_holder[0] = conn_holder[0].cursor()
            print(f"        [PG-RECONNECT] Reconnected successfully.")


def main():
    parser = argparse.ArgumentParser(description='GEOC-v14 Fuzzy Orphan Reconciliation')
    parser.add_argument('--dry-run', action='store_true', help='Report only, no database writes')
    parser.add_argument('--threshold', type=float, default=0.4, help='Minimum similarity threshold (0.0-1.0)')
    parser.add_argument('--output', default='data/fuzzy_orphan_report.csv', help='Output CSV path for match report')
    args = parser.parse_args()

    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_POOLED_URL")
    if not db_url:
        print("[FATAL] SUPABASE_DB_POOLED_URL missing")
        sys.exit(1)

    conn = make_connection(db_url)
    cur = conn.cursor()
    # Use mutable holders for reconnect
    conn_holder = [conn]
    cur_holder = [cur]

    print("="*70)
    print("  NASAKA GEOC-v14 FUZZY ORPHAN RECONCILIATION")
    print("="*70)

    # Step 1: Ensure pg_trgm extension is enabled
    print("\n  [1/5] Enabling pg_trgm extension...")
    resilient_query(conn_holder, db_url, cur_holder, "CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    conn_holder[0].commit()
    print("        pg_trgm ready.")

    # Step 2: Find all RC orphans (no exact match in OF)
    print("\n  [2/5] Finding RC orphans (no exact name+county match in OF)...")
    resilient_query(conn_holder, db_url, cur_holder, """
        SELECT rc.id, rc.name, rc.county, rc.constituency, rc.ward,
               rc.latitude, rc.longitude, rc.geocode_confidence, rc.location_source
        FROM public.iebc_registration_centres rc
        LEFT JOIN public.iebc_offices of
            ON UPPER(TRIM(REGEXP_REPLACE(rc.name, '\\s+', ' ', 'g')))
             = UPPER(TRIM(REGEXP_REPLACE(of.office_location, '\\s+', ' ', 'g')))
           AND UPPER(TRIM(REGEXP_REPLACE(rc.county, '\\s+', ' ', 'g')))
             = UPPER(TRIM(REGEXP_REPLACE(of.county, '\\s+', ' ', 'g')))
           AND of.office_type = 'REGISTRATION_CENTRE'
        WHERE of.id IS NULL
        ORDER BY rc.county, rc.constituency, rc.name
    """)
    orphans = cur_holder[0].fetchall()
    print(f"        Found {len(orphans)} orphan RC rows.")

    if len(orphans) == 0:
        print("        No orphans found. All RC rows have exact OF matches.")
        conn_holder[0].close()
        return

    # Step 3: For each orphan, find the best fuzzy match in OF within the same county
    print(f"\n  [3/5] Fuzzy matching {len(orphans)} orphans (threshold={args.threshold})...")

    matched = []
    unmatched = []
    low_confidence = []

    for i, orphan in enumerate(orphans):
        rc_id, rc_name, rc_county, rc_constituency, rc_ward, rc_lat, rc_lng, rc_conf, rc_source = orphan
        rc_name_norm = normalize(rc_name)
        rc_county_norm = normalize(rc_county)

        # Find best fuzzy match in OF within the same county
        resilient_query(conn_holder, db_url, cur_holder, """
            SELECT of.id, of.office_location, of.county, of.constituency,
                   of.latitude, of.longitude,
                   SIMILARITY(
                       UPPER(TRIM(REGEXP_REPLACE(of.office_location, '\\s+', ' ', 'g'))),
                       %s
                   ) AS sim_score
            FROM public.iebc_offices of
            WHERE of.office_type = 'REGISTRATION_CENTRE'
              AND UPPER(TRIM(REGEXP_REPLACE(of.county, '\\s+', ' ', 'g'))) = %s
              AND SIMILARITY(
                      UPPER(TRIM(REGEXP_REPLACE(of.office_location, '\\s+', ' ', 'g'))),
                      %s
                  ) >= %s
            ORDER BY sim_score DESC
            LIMIT 1
        """, (rc_name_norm, rc_county_norm, rc_name_norm, args.threshold))

        match = cur_holder[0].fetchone()

        if match:
            of_id, of_name, of_county, of_constituency, of_lat, of_lng, sim_score = match
            record = {
                'rc_id': str(rc_id),
                'rc_name': rc_name,
                'rc_county': rc_county,
                'rc_constituency': rc_constituency,
                'of_id': str(of_id),
                'of_name': of_name,
                'of_county': of_county,
                'of_constituency': of_constituency or '',
                'similarity': round(sim_score, 4),
                'rc_has_coords': 'YES' if rc_lat else 'NO',
                'of_has_coords': 'YES' if of_lat else 'NO',
                'action': ''
            }

            if sim_score >= 0.7:
                record['action'] = 'AUTO_MATCH'
                matched.append(record)
            elif sim_score >= args.threshold:
                record['action'] = 'LOW_CONFIDENCE'
                low_confidence.append(record)
        else:
            unmatched.append({
                'rc_id': str(rc_id),
                'rc_name': rc_name,
                'rc_county': rc_county,
                'rc_constituency': rc_constituency,
                'of_id': '',
                'of_name': '',
                'of_county': '',
                'of_constituency': '',
                'similarity': 0.0,
                'rc_has_coords': 'YES' if rc_lat else 'NO',
                'of_has_coords': '',
                'action': 'NO_MATCH'
            })

        if (i + 1) % 500 == 0 or (i + 1) == len(orphans):
            print(f"        Processed {i+1}/{len(orphans)} — matched: {len(matched)}, low_conf: {len(low_confidence)}, unmatched: {len(unmatched)}")
            # Commit periodically to keep transaction log small and connection active
            conn_holder[0].commit()

    print(f"\n        RESULTS:")
    print(f"          Auto-matched (sim >= 0.7):   {len(matched)}")
    print(f"          Low confidence ({args.threshold} <= sim < 0.7): {len(low_confidence)}")
    print(f"          No match found:              {len(unmatched)}")

    # Step 4: Apply auto-matches (forward sync coords from RC to matched OF rows)
    if not args.dry_run and len(matched) > 0:
        print(f"\n  [4/5] Applying {len(matched)} auto-matched forward syncs...")
        synced = 0
        for m in matched:
            if m['rc_has_coords'] == 'YES':
                resilient_query(conn_holder, db_url, cur_holder, """
                    UPDATE public.iebc_offices AS of
                    SET latitude = rc.latitude,
                        longitude = rc.longitude,
                        geocode_confidence = rc.geocode_confidence,
                        geocode_status = 'verified',
                        geocode_method = COALESCE(rc.location_source, 'fuzzy_orphan_match'),
                        verified = true,
                        updated_at = NOW()
                    FROM public.iebc_registration_centres AS rc
                    WHERE rc.id = %s::uuid
                      AND of.id = %s
                      AND rc.latitude IS NOT NULL
                      AND rc.longitude IS NOT NULL
                """, (m['rc_id'], int(m['of_id'])))
                synced += cur_holder[0].rowcount

        conn_holder[0].commit()
        print(f"        Synced {synced} coordinate pairs from RC → OF via fuzzy match.")
    elif args.dry_run:
        print(f"\n  [4/5] DRY RUN — skipping database writes.")
    else:
        print(f"\n  [4/5] No auto-matches to apply.")

    # Step 5: Write full report CSV
    print(f"\n  [5/5] Writing match report to {args.output}...")
    os.makedirs(os.path.dirname(args.output) or '.', exist_ok=True)
    all_records = matched + low_confidence + unmatched
    with open(args.output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'rc_id', 'rc_name', 'rc_county', 'rc_constituency',
            'of_id', 'of_name', 'of_county', 'of_constituency',
            'similarity', 'rc_has_coords', 'of_has_coords', 'action'
        ])
        writer.writeheader()
        writer.writerows(all_records)

    print(f"        Wrote {len(all_records)} records to {args.output}")

    # Final summary
    print("\n" + "="*70)
    print("  FUZZY ORPHAN RECONCILIATION SUMMARY")
    print("="*70)
    print(f"    Total orphans processed:        {len(orphans)}")
    print(f"    Auto-matched (sim >= 0.7):      {len(matched)}")
    print(f"    Low confidence (review needed):  {len(low_confidence)}")
    print(f"    Truly unmatched:                {len(unmatched)}")
    print(f"    Report:                         {args.output}")
    if not args.dry_run:
        # Post-sync counts
        resilient_query(conn_holder, db_url, cur_holder, "SELECT count(*) FROM public.iebc_offices WHERE latitude IS NOT NULL AND office_type = 'REGISTRATION_CENTRE'")
        of_coords = cur_holder[0].fetchone()[0]
        resilient_query(conn_holder, db_url, cur_holder, "SELECT count(*) FROM public.iebc_offices WHERE office_type = 'REGISTRATION_CENTRE'")
        of_total = cur_holder[0].fetchone()[0]
        print(f"    OF with coords (post-sync):     {of_coords} / {of_total} ({100*of_coords/of_total:.1f}%)")
    print("="*70)

    conn_holder[0].close()


if __name__ == "__main__":
    main()
