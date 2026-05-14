import psycopg2
import re

###############################################################################
# THIRD PASS: Hardcoded data from the authoritative PDF source
# "Physical_Locations_of_County_and_Constituency_Offices_in_Kenya 1.pdf"
# for the 22 rows that had no geocoded CSV match.
###############################################################################

DB_HOST = 'aws-0-eu-west-1.pooler.supabase.com'
DB_PORT = 6543
DB_NAME = 'postgres'
DB_USER = 'postgres.bfatlkobozblunojtltp'
DB_PASS = "1268Saem'sTunes!"

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

# Data extracted directly from the PDF — each entry is:
# (db_constituency_name, office_location, landmark, distance_str)
PDF_DATA = [
    # Page 17 — Bungoma County
    ("SIRISIA", "DCC Compound", "Sirisia DCC Office", "50 Metres"),
    ("TONGAREN", "Within Bungoma North Sub-County Headquaters", "National Government CDF Offices", "50 Metres"),

    # Page 18 — Busia County
    ("MATAYOS", "Assistant County Commissioner's Compound", "Assistant County Commissioner's Office", "10 Metres"),

    # Page 19 — Homa Bay County
    ("SUBA", "Inside Suba North Sub County Compound along Mbita - Rusinga Road", None, None),

    # Page 16 — Kakamega County
    ("BUTERE", "Butere DCC Compound Next to Kenya Forest Service Office, along Sabatia Shiatsala Road", "Deputy County Commissioner's Office", "10 Metres"),
    ("IKOLOMANI", "Sub-County Registrar of Persons Office", "Malinya Primary School", "100 Metres"),
    ("LIKUYANI", "At PAG Kongoni Church Compound", "Next to Likuyani Sub-County Offices", "50 Metres"),

    # Page 20 — Kisii County
    ("NYARIBARI CHACHE", "Kisii town", "County Commissioner's Office", "50 Metres"),

    # Page 1 — Kwale County
    ("MSAMBWENI", "Msambweni Dcc's Office Compound", "Subcounty Headquarters of Msambweni", "100 Metres"),

    # Page 7 — Makueni County
    ("MAKUENI", "Wote (Chief's Camp)", "Makueni Subcounty Hospital", "100 Metres"),

    # Page 21 — Nairobi County
    ("LANGATA", "Langata Subcounty Headquarters Five Star Road, Or Kwa Chief Wilson", "Five Star Road", "2 KMs"),

    # Page 14 — Narok County
    ("EMURUA DIKIRR", "Emurua Dikkir Sub County Offices", None, "10 Metres"),
    ("KILGORIS", "Old Kilgoris County Council Offices", "Cooperative Bank Kilgoris", "80 Metres"),

    # Page 8 — Nyandarua County
    ("OL JOROK", "Nyandarua West Subcounty Headquaters", "Nyandarua West Subcounty Headquaters", "0 Metres"),
    ("OL KALOU", "IEBC County Headqauters", "Posta Building Olkalou", "0 Metres"),

    # Page 8 — Nyeri County
    ("MUKURWEINI", "Mukurwe-ini DCC Grounds Offices", "Near Mukurwe-ini Sub County Hospital", "200 Meters"),
    ("TETU", "Tetu Sub County Headquarters Wamagana", "Deputy County Commissioner (DCC) Offices or Tetu National Government Constituency Development Fund (NGCDF) Offices", "50 Meters"),

    # Page 18 — Siaya County
    ("ALEGO USONGA", "Siaya Town - Within County Commissioners Office Compound", "County Commissioner's Office", "100 Metres"),
    ("UGENYA", "Ukwala - Opposite Sub County Officers", "Posta - Ukwala", "100 Metres"),

    # Page 3 — Taita Taveta County
    ("VOI", "Behind Taita Taveta County Public Service Board", "Voi Remand GK Prison", "100 Metres"),
    ("WUNDANYI", "Along Administration offices (Deputy County Commissioner office, County Government Departmental offices)", "Next to Kenya Forest Service County Office", "50 Meters"),

    # Page 5 — Tharaka-Nithi County
    ("CHUKA IGAMBANGOMBE", "Chuka Town, Sub County Office Compound", "Opposite Trans National Bank", "200 Metres"),
]


def normalize(s):
    if not s:
        return ''
    s = s.strip().upper()
    s = re.sub(r'[^A-Z0-9\s]', '', s)
    s = re.sub(r'\s+', ' ', s)
    return s


def parse_distance(val):
    if not val:
        return None
    m = re.search(r'([\d.]+)', val.strip())
    if m:
        try:
            v = float(m.group(1))
            # Convert km to meters
            if 'km' in val.lower():
                v = v * 1000
            return v
        except ValueError:
            return None
    return None


def main():
    print("=" * 80)
    print("THIRD PASS: PDF DATA FOR 22 REMAINING ROWS")
    print("=" * 80)

    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASS
    )
    conn.autocommit = False
    cur = conn.cursor()

    # Snapshot coordinates
    cur.execute("SELECT id, latitude, longitude FROM public.iebc_offices ORDER BY id")
    coord_snapshot = {r[0]: (r[1], r[2]) for r in cur.fetchall()}

    total_updates = 0
    total_cols = 0

    for const_name, office_loc, landmark, distance_str in PDF_DATA:
        # Find the DB row
        cur.execute("""SELECT id, county, constituency_name, office_location, landmark, 
            distance_from_landmark, geocode_method, clean_office_location,
            geocode_queries, geocode_query, direction_landmark, direction_distance,
            landmark_normalized, landmark_source, result_type, importance_score,
            geocode_status, formatted_address
            FROM public.iebc_offices 
            WHERE UPPER(constituency_name) = %s""", (const_name.upper(),))
        row = cur.fetchone()

        if not row:
            # Try fuzzy
            cur.execute("""SELECT id, county, constituency_name, office_location, landmark, 
                distance_from_landmark, geocode_method, clean_office_location,
                geocode_queries, geocode_query, direction_landmark, direction_distance,
                landmark_normalized, landmark_source, result_type, importance_score,
                geocode_status, formatted_address
                FROM public.iebc_offices 
                WHERE UPPER(constituency_name) ILIKE %s""", (f'%{const_name}%',))
            row = cur.fetchone()

        if not row:
            print(f"  NOT FOUND: {const_name}")
            continue

        row_id = row[0]
        db_county = row[1]
        db_const = row[2]
        db_geocode_method = row[6]
        db_clean_loc = row[7]
        db_geo_queries = row[8]
        db_geo_query = row[9]
        db_dir_landmark = row[10]
        db_dir_distance = row[11]
        db_lm_norm = row[12]
        db_lm_source = row[13]
        db_result_type = row[14]
        db_importance = row[15]
        db_geocode_status = row[16]
        db_formatted_addr = row[17]

        updates = {}
        reasons = []

        # b(1) — Always overwrite: office_location, landmark, distance_from_landmark
        if office_loc:
            updates['office_location'] = office_loc
            reasons.append(f"office_location <- PDF: '{office_loc}'")

        if landmark:
            updates['landmark'] = landmark
            reasons.append(f"landmark <- PDF: '{landmark}'")

        dist = parse_distance(distance_str)
        if dist is not None:
            updates['distance_from_landmark'] = dist
            reasons.append(f"distance_from_landmark <- PDF: {dist}")

        # b(2) — Fill NULLs only
        if not db_clean_loc and office_loc:
            clean_loc = re.sub(r'[^A-Za-z0-9\s,.\'-]', '', office_loc).strip().upper()
            updates['clean_office_location'] = clean_loc

        if not db_dir_landmark and landmark:
            updates['direction_landmark'] = landmark

        if not db_dir_distance and dist is not None:
            updates['direction_distance'] = dist

        if not db_lm_norm and landmark:
            updates['landmark_normalized'] = normalize(landmark)

        if not db_lm_source and landmark:
            updates['landmark_source'] = 'iebc_gazette_pdf'

        # geocode_method — mark as 'gazette_manual' if still NULL
        if not db_geocode_method:
            updates['geocode_method'] = 'gazette_manual'
            reasons.append("geocode_method <- 'gazette_manual'")

        if not db_geocode_status:
            updates['geocode_status'] = 'gazette_extracted'

        if not db_result_type:
            updates['result_type'] = 'gazette_manual'

        if not db_formatted_addr and office_loc:
            updates['formatted_address'] = f"{office_loc}, {db_const}, {db_county} County, Kenya"

        if not db_geo_queries and office_loc:
            updates['geocode_queries'] = f"{office_loc}, {db_const}, {db_county} County, Kenya"

        if not db_geo_query and office_loc:
            updates['geocode_query'] = f"{office_loc}, {db_const}, {db_county} County, Kenya"

        if db_importance is None:
            updates['importance_score'] = 0.5

        # geocode_confidence for gazette manual entries
        cur.execute("SELECT geocode_confidence FROM public.iebc_offices WHERE id = %s", (row_id,))
        if cur.fetchone()[0] is None:
            updates['geocode_confidence'] = 0.3

        cur.execute("SELECT accuracy_meters FROM public.iebc_offices WHERE id = %s", (row_id,))
        if cur.fetchone()[0] is None:
            updates['accuracy_meters'] = 10000.0

        cur.execute("SELECT total_queries_tried FROM public.iebc_offices WHERE id = %s", (row_id,))
        if cur.fetchone()[0] is None:
            updates['total_queries_tried'] = 0

        # Safety: remove NEVER_TOUCH
        for col in list(updates.keys()):
            if col in NEVER_TOUCH_COLUMNS:
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
            print(f"  ID={row_id} {db_county}/{db_const} -> {len(updates)} cols | {'; '.join(reasons[:3])}")

    conn.commit()
    print(f"\nCOMMITTED. Updated {total_updates} rows, {total_cols} total column values.")

    # Verify coordinates unchanged
    cur.execute("SELECT id, latitude, longitude FROM public.iebc_offices ORDER BY id")
    coord_violations = 0
    for r in cur.fetchall():
        orig = coord_snapshot.get(r[0])
        if orig and (r[1] != orig[0] or r[2] != orig[1]):
            coord_violations += 1
            print(f"  COORDINATE VIOLATION: ID={r[0]}")
    print(f"Coordinate violations: {coord_violations} {'OK' if coord_violations == 0 else 'VIOLATION!'}")

    # Final NULL audit
    cur.execute("""
        SELECT 
          COUNT(*) FILTER (WHERE landmark IS NULL OR landmark = '') as null_lm,
          COUNT(*) FILTER (WHERE geocode_method IS NULL OR geocode_method = '') as null_gm,
          COUNT(*) FILTER (WHERE clean_office_location IS NULL OR clean_office_location = '') as null_cl,
          COUNT(*) FILTER (WHERE formatted_address IS NULL OR formatted_address = '') as null_fa,
          COUNT(*) FILTER (WHERE geocode_status IS NULL OR geocode_status = '') as null_gs,
          COUNT(*) FILTER (WHERE distance_from_landmark IS NULL) as null_dist
        FROM public.iebc_offices
    """)
    r = cur.fetchone()
    print(f"\nFinal NULLs: landmark={r[0]}, geocode_method={r[1]}, clean_loc={r[2]}, formatted_addr={r[3]}, geocode_status={r[4]}, distance={r[5]}")

    # NEVER-TOUCH check
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
    nt = cur.fetchone()[0]
    print(f"NEVER-TOUCH violations: {nt} {'OK' if nt == 0 else 'VIOLATION!'}")

    cur.execute("SELECT COUNT(*) FROM public.iebc_offices")
    total = cur.fetchone()[0]
    print(f"Total rows: {total}")

    conn.close()
    print("Done.")


if __name__ == '__main__':
    main()
