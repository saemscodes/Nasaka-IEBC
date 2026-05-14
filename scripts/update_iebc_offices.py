import psycopg2
import csv
import re
import sys
from difflib import SequenceMatcher

###############################################################################
# CONFIGURATION
###############################################################################

DB_HOST = 'aws-0-eu-west-1.pooler.supabase.com'
DB_PORT = 6543
DB_NAME = 'postgres'
DB_USER = 'postgres.bfatlkobozblunojtltp'
DB_PASS = "1268Saem'sTunes!"

GEOCODED_CSV = r'D:\CEKA\RECALL254\scripts\data\geocoded_iebc_offices.csv'
RAW_CSV = r'D:\CEKA\NASAKA\v005\data\processed\raw_iebc_offices.csv'

# ─────────────────────────────────────────────────────────────────────────────
# NEVER-TOUCH COLUMNS — These are NEVER modified by this script under any
# circumstance. They are either anchors or explicitly protected.
# ─────────────────────────────────────────────────────────────────────────────
NEVER_TOUCH_COLUMNS = frozenset([
    'id',
    'latitude',
    'longitude',
    'verified_latitude',
    'verified_longitude',
    'geom',
    'source',
    'verified',
    'verified_at',
    'verifier_id',
    'verification_source',
    'verified_by',
    'office_type',
    'returning_officer_name',
    'returning_officer_email',
    'created_at',
    'contributor_image_url',
    'confidence_score',
    'created_from_contribution_id',
    'image_url',
    'submission_source',
    'submission_method',
    'linked_contribution_ids',
    'geocode_verified',
    'geocode_verified_at',
    'multi_source_confidence',
    'ward_id',
    'isochrone_15min',
    'isochrone_30min',
    'isochrone_45min',
    'elevation_meters',
])

# ─────────────────────────────────────────────────────────────────────────────
# ANCHOR COLUMNS — Used for matching only. Not updated unless cell is NULL.
# ─────────────────────────────────────────────────────────────────────────────
ANCHOR_COLUMNS = frozenset([
    'county',
    'constituency',
    'constituency_name',
])

###############################################################################
# HELPERS
###############################################################################

def normalize(s):
    """Normalize a string for matching: uppercase, strip, collapse whitespace, remove punctuation."""
    if not s:
        return ''
    s = s.strip().upper()
    s = re.sub(r'[^A-Z0-9\s]', '', s)
    s = re.sub(r'\s+', ' ', s)
    return s


def fuzzy_ratio(a, b):
    """Return similarity ratio between two strings (0.0 - 1.0)."""
    return SequenceMatcher(None, a, b).ratio()


def parse_distance(val):
    """Parse distance string like '0 meters' or '100 Metres' to float. Returns None if unparseable."""
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
    """Convert to float or return None."""
    if val is None or val == '':
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def safe_int(val):
    """Convert to int or return None."""
    if val is None or val == '':
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def load_geocoded_csv(path):
    """Load geocoded CSV and return a dict keyed by (normalized_county, normalized_constituency_name)."""
    data = {}
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            county_n = normalize(row.get('county', ''))
            const_n = normalize(row.get('constituency_name', ''))
            if not county_n or not const_n:
                continue
            key = (county_n, const_n)
            # Keep only the first row per constituency (the constituency office row)
            if key not in data:
                data[key] = row
    return data


def load_raw_csv(path):
    """Load raw IEBC offices CSV, skip gazette headers, return dict keyed by
    (normalized_county, normalized_constituency_name) with first valid row per constituency."""
    data = {}
    garbage_indicators = ['GAZETTE', 'KENYA GAZETTE', 'CONSTITUTION', 'SPECIAL ISSUE', 'Vol.']
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            county_raw = row.get('county', '').strip()
            const_raw = row.get('constituency_name', '').strip()
            # Skip garbage rows
            if not county_raw or not const_raw:
                continue
            if any(g in county_raw.upper() for g in garbage_indicators):
                continue
            if any(g in const_raw.upper() for g in garbage_indicators):
                continue
            if const_raw.upper() in ('CONSTITUENCY OFFICES.', 'CONSTITUENCY OFFICES'):
                continue

            county_n = normalize(county_raw)
            const_n = normalize(const_raw)
            if not county_n or not const_n:
                continue

            key = (county_n, const_n)
            if key not in data:
                data[key] = row
    return data


def build_fuzzy_map(db_rows, csv_keys):
    """Build a mapping from DB (county, constituency_name) to best-matching CSV key.
    db_rows: list of tuples (id, county, constituency_code, constituency, constituency_name, ...)
    csv_keys: set of (normalized_county, normalized_constituency_name) keys from CSV
    Returns: dict mapping db_key -> csv_key
    """
    mapping = {}
    csv_keys_list = list(csv_keys)

    for row in db_rows:
        db_county = normalize(row[1])
        db_const = normalize(row[4]) if row[4] else normalize(row[3])
        db_key = (db_county, db_const)

        # 1. Exact match
        if db_key in csv_keys:
            mapping[row[0]] = db_key
            continue

        # 2. Fuzzy match: same county, best constituency_name match
        best_score = 0.0
        best_key = None
        for ck in csv_keys_list:
            csv_county, csv_const = ck
            # County must be close
            county_score = fuzzy_ratio(db_county, csv_county)
            if county_score < 0.7:
                continue
            const_score = fuzzy_ratio(db_const, csv_const)
            combined = county_score * 0.3 + const_score * 0.7
            if combined > best_score:
                best_score = combined
                best_key = ck

        if best_key and best_score >= 0.55:
            mapping[row[0]] = best_key
        else:
            # 3. Substring containment check as last resort
            for ck in csv_keys_list:
                csv_county, csv_const = ck
                if db_county in csv_county or csv_county in db_county:
                    if db_const in csv_const or csv_const in db_const:
                        mapping[row[0]] = ck
                        break

    return mapping


###############################################################################
# MAIN
###############################################################################

def main():
    print("=" * 80)
    print("IEBC OFFICES DATABASE UPDATE SCRIPT")
    print("=" * 80)

    # ─── Connect ──────────────────────────────────────────────────────────
    print("\n[1/7] Connecting to database...")
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASS
    )
    conn.autocommit = False
    cur = conn.cursor()
    print("  Connected.")

    # ─── Backup ───────────────────────────────────────────────────────────
    print("\n[2/7] Creating backup table public.iebc_offices_backup_may...")
    cur.execute("DROP TABLE IF EXISTS public.iebc_offices_backup_may")
    cur.execute("CREATE TABLE public.iebc_offices_backup_may AS SELECT * FROM public.iebc_offices")
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices_backup_may")
    backup_count = cur.fetchone()[0]
    print(f"  Backup created: {backup_count} rows.")
    conn.commit()

    # ─── Snapshot coordinates for verification ────────────────────────────
    print("\n[3/7] Snapshotting coordinates for post-update verification...")
    cur.execute("SELECT id, latitude, longitude FROM public.iebc_offices ORDER BY id")
    coord_snapshot = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
    print(f"  Snapshotted {len(coord_snapshot)} coordinate pairs.")

    # ─── Load CSV sources ─────────────────────────────────────────────────
    print("\n[4/7] Loading CSV sources...")
    geocoded = load_geocoded_csv(GEOCODED_CSV)
    print(f"  Geocoded CSV: {len(geocoded)} unique constituency entries loaded.")
    raw = load_raw_csv(RAW_CSV)
    print(f"  Raw CSV: {len(raw)} unique constituency entries loaded.")

    # ─── Load all DB rows ─────────────────────────────────────────────────
    print("\n[5/7] Loading all DB rows...")
    cur.execute("""
        SELECT id, county, constituency_code, constituency, constituency_name,
               office_location, landmark, distance_from_landmark,
               ward, ward_code, centre_code, county_code, category, office_type,
               caw_code, clean_office_location,
               geocode_method, geocode_confidence, accuracy_meters,
               formatted_address, successful_geocode_query, total_queries_tried,
               geocode_status, geocode_queries, geocode_query,
               direction_type, direction_landmark, direction_distance,
               landmark_type, landmark_subtype, landmark_normalized, landmark_source,
               result_type, importance_score, notes,
               source, verified, returning_officer_name, returning_officer_email
        FROM public.iebc_offices ORDER BY id
    """)
    columns = [desc[0] for desc in cur.description]
    db_rows_raw = cur.fetchall()
    db_rows = []
    for r in db_rows_raw:
        db_rows.append(dict(zip(columns, r)))
    print(f"  Loaded {len(db_rows)} DB rows.")

    # ─── Build matching maps ──────────────────────────────────────────────
    print("\n[6/7] Building fuzzy matching maps...")
    # Convert db_rows to the tuple format expected by build_fuzzy_map
    db_tuples = [(r['id'], r['county'], r['constituency_code'], r['constituency'], r['constituency_name']) for r in db_rows]

    geo_map = build_fuzzy_map(db_tuples, set(geocoded.keys()))
    print(f"  Geocoded matches: {len(geo_map)}/{len(db_rows)}")
    unmatched_geo = [r['id'] for r in db_rows if r['id'] not in geo_map]
    if unmatched_geo:
        print(f"  Unmatched (geocoded): {len(unmatched_geo)} rows:")
        for uid in unmatched_geo:
            row = next(r for r in db_rows if r['id'] == uid)
            print(f"    ID={uid} county={row['county']} const={row['constituency_name']}")

    raw_map = build_fuzzy_map(db_tuples, set(raw.keys()))
    print(f"  Raw matches: {len(raw_map)}/{len(db_rows)}")
    unmatched_raw = [r['id'] for r in db_rows if r['id'] not in raw_map]
    if unmatched_raw:
        print(f"  Unmatched (raw): {len(unmatched_raw)} rows:")
        for uid in unmatched_raw:
            row = next(r for r in db_rows if r['id'] == uid)
            print(f"    ID={uid} county={row['county']} const={row['constituency_name']}")

    # ─── Execute updates ──────────────────────────────────────────────────
    print("\n[7/7] Executing updates...")
    total_updates = 0
    total_columns_updated = 0
    update_report = []

    for db_row in db_rows:
        row_id = db_row['id']
        updates = {}
        reasons = []

        # ─────────────────────────────────────────────────────────────
        # SOURCE 1: GEOCODED CSV — b(1) columns (always overwrite)
        # ─────────────────────────────────────────────────────────────
        geo_key = geo_map.get(row_id)
        if geo_key:
            geo_row = geocoded[geo_key]

            # b(1) — ALWAYS overwrite these from geocoded CSV
            geo_office_loc = geo_row.get('office_location', '').strip()
            if geo_office_loc:
                updates['office_location'] = geo_office_loc
                reasons.append(f"office_location <- geocoded: '{geo_office_loc}'")

            geo_landmark = geo_row.get('landmark', '').strip()
            if geo_landmark:
                updates['landmark'] = geo_landmark
                reasons.append(f"landmark <- geocoded: '{geo_landmark}'")

            geo_distance = parse_distance(geo_row.get('distance_from_landmark', ''))
            if geo_distance is not None:
                updates['distance_from_landmark'] = geo_distance
                reasons.append(f"distance_from_landmark <- geocoded: {geo_distance}")

            geo_method = geo_row.get('geocode_method', '').strip()
            if geo_method:
                updates['geocode_method'] = geo_method
                reasons.append(f"geocode_method <- geocoded: '{geo_method}'")

            geo_conf = safe_float(geo_row.get('geocode_confidence', ''))
            if geo_conf is not None:
                updates['geocode_confidence'] = geo_conf
                reasons.append(f"geocode_confidence <- geocoded: {geo_conf}")

            geo_acc = safe_float(geo_row.get('accuracy_meters', ''))
            if geo_acc is not None:
                updates['accuracy_meters'] = geo_acc
                reasons.append(f"accuracy_meters <- geocoded: {geo_acc}")

            geo_addr = geo_row.get('formatted_address', '').strip()
            if geo_addr:
                updates['formatted_address'] = geo_addr
                reasons.append(f"formatted_address <- geocoded: '{geo_addr}'")

            geo_sgq = geo_row.get('successful_geocode_query', '').strip()
            if geo_sgq:
                updates['successful_geocode_query'] = geo_sgq
                reasons.append(f"successful_geocode_query <- geocoded: '{geo_sgq}'")

            geo_tqt = safe_int(geo_row.get('total_queries_tried', ''))
            if geo_tqt is not None:
                updates['total_queries_tried'] = geo_tqt
                reasons.append(f"total_queries_tried <- geocoded: {geo_tqt}")

            geo_status = geo_row.get('geocode_status', '').strip()
            if geo_status:
                updates['geocode_status'] = geo_status
                reasons.append(f"geocode_status <- geocoded: '{geo_status}'")

            # b(2) — Fill NULLs from geocoded CSV where applicable
            if not db_row.get('geocode_queries') and geo_sgq:
                updates['geocode_queries'] = geo_sgq
                reasons.append(f"geocode_queries <- geocoded (was NULL)")

            if not db_row.get('geocode_query') and geo_sgq:
                updates['geocode_query'] = geo_sgq
                reasons.append(f"geocode_query <- geocoded (was NULL)")

            # clean_office_location from geocoded office_location
            if not db_row.get('clean_office_location') and geo_office_loc:
                clean_loc = re.sub(r'[^A-Za-z0-9\s,.\'-]', '', geo_office_loc).strip().upper()
                updates['clean_office_location'] = clean_loc
                reasons.append(f"clean_office_location <- geocoded (was NULL)")

            # direction fields from landmark/distance
            if not db_row.get('direction_landmark') and geo_landmark:
                updates['direction_landmark'] = geo_landmark
                reasons.append(f"direction_landmark <- geocoded landmark (was NULL)")

            if not db_row.get('direction_distance') and geo_distance is not None:
                updates['direction_distance'] = geo_distance
                reasons.append(f"direction_distance <- geocoded distance (was NULL)")

            # landmark_normalized from landmark
            if not db_row.get('landmark_normalized') and geo_landmark:
                ln = normalize(geo_landmark)
                updates['landmark_normalized'] = ln
                reasons.append(f"landmark_normalized <- normalized geocoded landmark (was NULL)")

            # landmark_source
            if not db_row.get('landmark_source') and geo_landmark:
                updates['landmark_source'] = 'geocoded_csv'
                reasons.append(f"landmark_source <- 'geocoded_csv' (was NULL)")

            # result_type from geocode_method
            if not db_row.get('result_type') and geo_method:
                updates['result_type'] = geo_method
                reasons.append(f"result_type <- geocode_method (was NULL)")

            # importance_score from geocode_confidence
            if db_row.get('importance_score') is None and geo_conf is not None:
                updates['importance_score'] = geo_conf
                reasons.append(f"importance_score <- geocode_confidence (was NULL)")

        # ─────────────────────────────────────────────────────────────
        # SOURCE 2: RAW CSV — b(2) columns (fill NULLs only)
        # ─────────────────────────────────────────────────────────────
        raw_key = raw_map.get(row_id)
        if raw_key:
            raw_row = raw[raw_key]

            # ward — fill if NULL
            if not db_row.get('ward'):
                raw_ward = raw_row.get('ward', '').strip()
                if raw_ward:
                    updates['ward'] = raw_ward
                    reasons.append(f"ward <- raw: '{raw_ward}' (was NULL)")

            # ward_code — fill if NULL
            if not db_row.get('ward_code'):
                raw_wc = raw_row.get('ward_code', '').strip()
                if raw_wc:
                    updates['ward_code'] = raw_wc
                    reasons.append(f"ward_code <- raw: '{raw_wc}' (was NULL)")

            # centre_code — fill if NULL
            if not db_row.get('centre_code'):
                raw_cc = raw_row.get('centre_code', '').strip()
                if raw_cc:
                    updates['centre_code'] = raw_cc
                    reasons.append(f"centre_code <- raw: '{raw_cc}' (was NULL)")

            # county_code — fill if NULL
            if not db_row.get('county_code'):
                raw_ctc = raw_row.get('county_code', '').strip()
                if raw_ctc:
                    updates['county_code'] = raw_ctc
                    reasons.append(f"county_code <- raw: '{raw_ctc}' (was NULL)")

            # constituency_code — fill if NULL or 0
            if not db_row.get('constituency_code') or db_row.get('constituency_code') == 0:
                raw_conc = raw_row.get('constituency_code', '').strip()
                if raw_conc:
                    raw_conc_int = safe_int(raw_conc)
                    if raw_conc_int is not None and raw_conc_int > 0:
                        updates['constituency_code'] = raw_conc_int
                        reasons.append(f"constituency_code <- raw: {raw_conc_int} (was NULL/0)")

            # category — fill if NULL (but DB has defaults, so only truly NULL)
            if not db_row.get('category'):
                raw_cat = raw_row.get('category', '').strip()
                if raw_cat:
                    updates['category'] = raw_cat
                    reasons.append(f"category <- raw: '{raw_cat}' (was NULL)")

            # caw_code — construct from county_code + constituency_code + ward_code
            if not db_row.get('caw_code'):
                c_code = updates.get('county_code', db_row.get('county_code', ''))
                co_code = str(updates.get('constituency_code', db_row.get('constituency_code', '')))
                w_code = updates.get('ward_code', db_row.get('ward_code', ''))
                if c_code and co_code and w_code and co_code != '0' and co_code != 'None' and co_code != '':
                    caw = f"{c_code}-{co_code}-{w_code}"
                    updates['caw_code'] = caw
                    reasons.append(f"caw_code <- constructed: '{caw}' (was NULL)")

        # ─────────────────────────────────────────────────────────────
        # SAFETY: Remove any NEVER_TOUCH columns that might have crept in
        # ─────────────────────────────────────────────────────────────
        for col in list(updates.keys()):
            if col in NEVER_TOUCH_COLUMNS:
                del updates[col]
                reasons = [r for r in reasons if not r.startswith(col)]

        # Also remove anchor columns (don't update county/constituency/constituency_name)
        for col in ANCHOR_COLUMNS:
            if col in updates:
                del updates[col]
                reasons = [r for r in reasons if not r.startswith(col)]

        # ─────────────────────────────────────────────────────────────
        # Execute the UPDATE
        # ─────────────────────────────────────────────────────────────
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
            total_columns_updated += len(updates)
            update_report.append({
                'id': row_id,
                'county': db_row['county'],
                'constituency_name': db_row['constituency_name'],
                'columns_updated': len(updates),
                'geo_matched': geo_key is not None,
                'raw_matched': raw_key is not None,
                'details': reasons
            })

    # ─── Commit ───────────────────────────────────────────────────────────
    conn.commit()
    print(f"\n  COMMITTED. Updated {total_updates} rows, {total_columns_updated} total column values.")

    # ─── VERIFICATION ─────────────────────────────────────────────────────
    print("\n" + "=" * 80)
    print("VERIFICATION")
    print("=" * 80)

    # 1. Row count
    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    post_count = cur.fetchone()[0]
    print(f"\n  Row count: {post_count} (expected 290) {'✓' if post_count == 290 else '✗ MISMATCH!'}")

    # 2. Coordinate integrity
    cur.execute("SELECT id, latitude, longitude FROM public.iebc_offices ORDER BY id")
    coord_check = cur.fetchall()
    coord_violations = 0
    for r in coord_check:
        rid, lat, lon = r
        orig = coord_snapshot.get(rid)
        if orig:
            if lat != orig[0] or lon != orig[1]:
                coord_violations += 1
                print(f"  ✗ COORDINATE VIOLATION: ID={rid} lat {orig[0]}->{lat} lon {orig[1]}->{lon}")
    print(f"  Coordinate integrity: {'✓ ALL INTACT' if coord_violations == 0 else f'✗ {coord_violations} VIOLATIONS!'}")

    # 3. Post-update NULL audit
    cur.execute("""
        SELECT 
          COUNT(*) FILTER (WHERE landmark IS NULL OR landmark = '') as null_landmark,
          COUNT(*) FILTER (WHERE distance_from_landmark IS NULL) as null_distance,
          COUNT(*) FILTER (WHERE geocode_method IS NULL OR geocode_method = '') as null_geocode_method,
          COUNT(*) FILTER (WHERE geocode_confidence IS NULL) as null_geocode_confidence,
          COUNT(*) FILTER (WHERE accuracy_meters IS NULL) as null_accuracy,
          COUNT(*) FILTER (WHERE formatted_address IS NULL OR formatted_address = '') as null_formatted_addr,
          COUNT(*) FILTER (WHERE successful_geocode_query IS NULL OR successful_geocode_query = '') as null_successful_geo,
          COUNT(*) FILTER (WHERE total_queries_tried IS NULL) as null_total_queries,
          COUNT(*) FILTER (WHERE geocode_status IS NULL OR geocode_status = '') as null_geocode_status,
          COUNT(*) FILTER (WHERE ward IS NULL OR ward = '') as null_ward,
          COUNT(*) FILTER (WHERE ward_code IS NULL OR ward_code = '') as null_ward_code,
          COUNT(*) FILTER (WHERE centre_code IS NULL OR centre_code = '') as null_centre_code,
          COUNT(*) FILTER (WHERE county_code IS NULL OR county_code = '') as null_county_code,
          COUNT(*) FILTER (WHERE caw_code IS NULL OR caw_code = '') as null_caw_code,
          COUNT(*) FILTER (WHERE constituency_code IS NULL OR constituency_code = 0) as null_const_code,
          COUNT(*) FILTER (WHERE clean_office_location IS NULL OR clean_office_location = '') as null_clean_loc,
          COUNT(*) FILTER (WHERE geocode_queries IS NULL OR geocode_queries = '') as null_geo_queries,
          COUNT(*) FILTER (WHERE geocode_query IS NULL OR geocode_query = '') as null_geo_query,
          COUNT(*) FILTER (WHERE direction_landmark IS NULL OR direction_landmark = '') as null_dir_landmark,
          COUNT(*) FILTER (WHERE direction_distance IS NULL) as null_dir_distance,
          COUNT(*) FILTER (WHERE landmark_normalized IS NULL OR landmark_normalized = '') as null_lm_norm,
          COUNT(*) FILTER (WHERE result_type IS NULL OR result_type = '') as null_result_type,
          COUNT(*) FILTER (WHERE importance_score IS NULL) as null_importance
        FROM public.iebc_offices
    """)
    post_nulls = cur.fetchone()
    labels = ['landmark','distance','geocode_method','geocode_confidence','accuracy',
              'formatted_addr','successful_geo','total_queries','geocode_status',
              'ward','ward_code','centre_code','county_code','caw_code','constituency_code',
              'clean_loc','geo_queries','geo_query','dir_landmark','dir_distance',
              'landmark_norm','result_type','importance']

    # Pre-update values (from our earlier audit)
    pre_nulls = [290, 290, 290, 290, 290, 290, 290, 290, 290, 290, 6, 6, 6, 290, 28, 290, 290, 290, 290, 290, 290, 290, 290]

    print(f"\n  {'Column':<25} {'Before':>8} {'After':>8} {'Filled':>8}")
    print(f"  {'-'*25} {'-'*8} {'-'*8} {'-'*8}")
    for l, pre, post in zip(labels, pre_nulls, post_nulls):
        filled = pre - post
        indicator = '✓' if filled > 0 else '-'
        print(f"  {l:<25} {pre:>8} {post:>8} {filled:>8} {indicator}")

    # 4. Verify NEVER-TOUCH columns unchanged
    print("\n  Verifying NEVER-TOUCH columns unchanged...")
    cur.execute("""
        SELECT COUNT(*) FROM public.iebc_offices a 
        JOIN public.iebc_offices_backup_may b ON a.id = b.id 
        WHERE a.source IS DISTINCT FROM b.source 
           OR a.verified IS DISTINCT FROM b.verified 
           OR a.office_type IS DISTINCT FROM b.office_type
           OR a.returning_officer_name IS DISTINCT FROM b.returning_officer_name
           OR a.returning_officer_email IS DISTINCT FROM b.returning_officer_email
    """)
    nt_violations = cur.fetchone()[0]
    print(f"  NEVER-TOUCH columns: {'✓ ALL INTACT' if nt_violations == 0 else f'✗ {nt_violations} VIOLATIONS!'}")

    # ─── Print update report ──────────────────────────────────────────────
    print("\n" + "=" * 80)
    print("UPDATE REPORT")
    print("=" * 80)
    for entry in update_report:
        geo_tag = "[GEO✓]" if entry['geo_matched'] else "[GEO✗]"
        raw_tag = "[RAW✓]" if entry['raw_matched'] else "[RAW✗]"
        print(f"\n  ID={entry['id']} | {entry['county']} / {entry['constituency_name']} | {geo_tag} {raw_tag} | {entry['columns_updated']} cols")
        for d in entry['details']:
            print(f"    → {d}")

    # ─── Summary ──────────────────────────────────────────────────────────
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"  Total DB rows: {post_count}")
    print(f"  Rows updated: {total_updates}")
    print(f"  Total column values written: {total_columns_updated}")
    print(f"  Coordinate violations: {coord_violations}")
    print(f"  NEVER-TOUCH violations: {nt_violations}")
    print(f"  Backup table: public.iebc_offices_backup_may ({backup_count} rows)")
    geo_matched = sum(1 for e in update_report if e['geo_matched'])
    raw_matched = sum(1 for e in update_report if e['raw_matched'])
    print(f"  Geocoded CSV matches: {len(geo_map)}/{len(db_rows)}")
    print(f"  Raw CSV matches: {len(raw_map)}/{len(db_rows)}")

    conn.close()
    print("\n  Done. Connection closed.")


if __name__ == '__main__':
    main()
