import psycopg2
import csv
import re
from difflib import SequenceMatcher

###############################################################################
# Second pass: Match remaining DB rows to geocoded CSV by constituency_name
# alone (ignoring county), since the geocoded CSV has many constituencies
# filed under incorrect counties.
###############################################################################

DB_HOST = 'aws-0-eu-west-1.pooler.supabase.com'
DB_PORT = 6543
DB_NAME = 'postgres'
DB_USER = 'postgres.bfatlkobozblunojtltp'
DB_PASS = "1268Saem'sTunes!"

GEOCODED_CSV = r'D:\CEKA\RECALL254\scripts\data\geocoded_iebc_offices.csv'

NEVER_TOUCH_COLUMNS = frozenset([
    'id', 'latitude', 'longitude', 'verified_latitude', 'verified_longitude',
    'geom', 'source', 'verified', 'verified_at', 'verifier_id',
    'verification_source', 'verified_by', 'office_type',
    'returning_officer_name', 'returning_officer_email', 'created_at',
    'contributor_image_url', 'confidence_score', 'created_from_contribution_id',
    'image_url', 'submission_source', 'submission_method',
    'linked_contribution_ids', 'geocode_verified', 'geocode_verified_at',
    'multi_source_confidence', 'ward_id', 'isochrone_15min', 'isochrone_30min',
    'isochrone_45min', 'elevation_meters',
])

ANCHOR_COLUMNS = frozenset(['county', 'constituency', 'constituency_name'])


def normalize(s):
    if not s:
        return ''
    s = s.strip().upper()
    s = re.sub(r'[^A-Z0-9\s]', '', s)
    s = re.sub(r'\s+', ' ', s)
    return s


def fuzzy_ratio(a, b):
    return SequenceMatcher(None, a, b).ratio()


def parse_distance(val):
    if not val or val.strip() == '':
        return None
    m = re.search(r'([\d.]+)', val.strip())
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            return None
    return None


def safe_float(val):
    if val is None or val == '':
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def safe_int(val):
    if val is None or val == '':
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def main():
    print("=" * 80)
    print("SECOND PASS: GEOCODED DATA BY CONSTITUENCY_NAME ONLY")
    print("=" * 80)

    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASS
    )
    conn.autocommit = False
    cur = conn.cursor()

    # Load geocoded CSV keyed by normalized constituency_name only
    geo_by_const = {}
    with open(GEOCODED_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            const_n = normalize(row.get('constituency_name', ''))
            if const_n and const_n not in geo_by_const:
                geo_by_const[const_n] = row
    print(f"Geocoded CSV: {len(geo_by_const)} unique constituency_names loaded.")

    # Get DB rows still missing geocode data
    cur.execute("""SELECT id, county, constituency_name, office_location,
        landmark, distance_from_landmark, geocode_method, geocode_confidence,
        accuracy_meters, formatted_address, successful_geocode_query,
        total_queries_tried, geocode_status, clean_office_location,
        geocode_queries, geocode_query, direction_landmark, direction_distance,
        landmark_normalized, landmark_source, result_type, importance_score
        FROM public.iebc_offices 
        WHERE geocode_method IS NULL OR geocode_method = '' 
        ORDER BY id""")
    columns = [desc[0] for desc in cur.description]
    missing_rows = [dict(zip(columns, r)) for r in cur.fetchall()]
    print(f"DB rows missing geocode data: {len(missing_rows)}")

    # Snapshot coordinates
    cur.execute("SELECT id, latitude, longitude FROM public.iebc_offices ORDER BY id")
    coord_snapshot = {r[0]: (r[1], r[2]) for r in cur.fetchall()}

    total_updates = 0
    total_cols = 0
    unmatched = []

    for db_row in missing_rows:
        row_id = db_row['id']
        db_const = normalize(db_row['constituency_name'])
        updates = {}
        reasons = []

        # Try exact match on constituency_name
        geo_row = geo_by_const.get(db_const)

        # Fuzzy fallback
        if not geo_row:
            best_score = 0.0
            best_key = None
            for gk in geo_by_const:
                score = fuzzy_ratio(db_const, gk)
                if score > best_score:
                    best_score = score
                    best_key = gk
            if best_key and best_score >= 0.75:
                geo_row = geo_by_const[best_key]
                reasons.append(f"FUZZY MATCH: '{db_const}' -> '{best_key}' (score={best_score:.2f})")
            elif best_key and best_score >= 0.6:
                # Substring check as extra safety
                if db_const in best_key or best_key in db_const:
                    geo_row = geo_by_const[best_key]
                    reasons.append(f"SUBSTRING MATCH: '{db_const}' -> '{best_key}' (score={best_score:.2f})")

        if not geo_row:
            unmatched.append((row_id, db_row['county'], db_row['constituency_name']))
            continue

        # b(1) — Always overwrite from geocoded CSV
        geo_office_loc = geo_row.get('office_location', '').strip()
        if geo_office_loc:
            updates['office_location'] = geo_office_loc
            reasons.append(f"office_location <- '{geo_office_loc}'")

        geo_landmark = geo_row.get('landmark', '').strip()
        if geo_landmark:
            updates['landmark'] = geo_landmark
            reasons.append(f"landmark <- '{geo_landmark}'")

        geo_distance = parse_distance(geo_row.get('distance_from_landmark', ''))
        if geo_distance is not None:
            updates['distance_from_landmark'] = geo_distance

        geo_method = geo_row.get('geocode_method', '').strip()
        if geo_method:
            updates['geocode_method'] = geo_method

        geo_conf = safe_float(geo_row.get('geocode_confidence', ''))
        if geo_conf is not None:
            updates['geocode_confidence'] = geo_conf

        geo_acc = safe_float(geo_row.get('accuracy_meters', ''))
        if geo_acc is not None:
            updates['accuracy_meters'] = geo_acc

        geo_addr = geo_row.get('formatted_address', '').strip()
        if geo_addr:
            updates['formatted_address'] = geo_addr

        geo_sgq = geo_row.get('successful_geocode_query', '').strip()
        if geo_sgq:
            updates['successful_geocode_query'] = geo_sgq

        geo_tqt = safe_int(geo_row.get('total_queries_tried', ''))
        if geo_tqt is not None:
            updates['total_queries_tried'] = geo_tqt

        geo_status = geo_row.get('geocode_status', '').strip()
        if geo_status:
            updates['geocode_status'] = geo_status

        # b(2) — Fill NULLs
        if not db_row.get('geocode_queries') and geo_sgq:
            updates['geocode_queries'] = geo_sgq

        if not db_row.get('geocode_query') and geo_sgq:
            updates['geocode_query'] = geo_sgq

        if not db_row.get('clean_office_location') and geo_office_loc:
            clean_loc = re.sub(r'[^A-Za-z0-9\s,.\'-]', '', geo_office_loc).strip().upper()
            updates['clean_office_location'] = clean_loc

        if not db_row.get('direction_landmark') and geo_landmark:
            updates['direction_landmark'] = geo_landmark

        if not db_row.get('direction_distance') and geo_distance is not None:
            updates['direction_distance'] = geo_distance

        if not db_row.get('landmark_normalized') and geo_landmark:
            updates['landmark_normalized'] = normalize(geo_landmark)

        if not db_row.get('landmark_source') and geo_landmark:
            updates['landmark_source'] = 'geocoded_csv'

        if not db_row.get('result_type') and geo_method:
            updates['result_type'] = geo_method

        if db_row.get('importance_score') is None and geo_conf is not None:
            updates['importance_score'] = geo_conf

        # Safety: remove NEVER_TOUCH and ANCHOR columns
        for col in list(updates.keys()):
            if col in NEVER_TOUCH_COLUMNS or col in ANCHOR_COLUMNS:
                del updates[col]

        if updates:
            set_clauses = []
            params = []
            for col, val in updates.items():
                set_clauses.append(f"{col} = %s")
                params.append(val)
            params.append(row_id)
            sql = f"UPDATE public.iebc_offices SET {', '.join(set_clauses)} WHERE id = %s"
            cur.execute(sql, params)
            total_updates += 1
            total_cols += len(updates)
            print(f"  ID={row_id} {db_row['county']}/{db_row['constituency_name']} -> {len(updates)} cols | {'; '.join(reasons[:2])}")

    conn.commit()
    print(f"\nCOMMITTED. Updated {total_updates} rows, {total_cols} total column values.")

    if unmatched:
        print(f"\nStill unmatched ({len(unmatched)}):")
        for uid, county, const in unmatched:
            print(f"  ID={uid} {county}/{const}")

    # Verify coordinates unchanged
    cur.execute("SELECT id, latitude, longitude FROM public.iebc_offices ORDER BY id")
    for r in cur.fetchall():
        orig = coord_snapshot.get(r[0])
        if orig and (r[1] != orig[0] or r[2] != orig[1]):
            print(f"  COORDINATE VIOLATION: ID={r[0]}")

    # Post counts
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE geocode_method IS NOT NULL AND geocode_method != ''")
    filled = cur.fetchone()[0]
    print(f"\nTotal rows with geocode_method now: {filled}/290")

    cur.execute("SELECT COUNT(*) FROM public.iebc_offices WHERE landmark IS NOT NULL AND landmark != ''")
    lm = cur.fetchone()[0]
    print(f"Total rows with landmark now: {lm}/290")

    # NEVER-TOUCH verification
    cur.execute("""
        SELECT COUNT(*) FROM public.iebc_offices a 
        JOIN public.iebc_offices_backup_may b ON a.id = b.id 
        WHERE a.source IS DISTINCT FROM b.source 
           OR a.verified IS DISTINCT FROM b.verified 
           OR a.office_type IS DISTINCT FROM b.office_type
           OR a.returning_officer_name IS DISTINCT FROM b.returning_officer_name
           OR a.returning_officer_email IS DISTINCT FROM b.returning_officer_email
           OR a.latitude IS DISTINCT FROM b.latitude
           OR a.longitude IS DISTINCT FROM b.longitude
    """)
    violations = cur.fetchone()[0]
    print(f"NEVER-TOUCH violations: {violations} {'OK' if violations == 0 else 'VIOLATION!'}")

    conn.close()
    print("Done.")


if __name__ == '__main__':
    main()
