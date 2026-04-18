"""
orphan_resolver.py — Step 0b

Pre-Geocoding Administrative Code Backfill.

Resolves all 30 administrative columns (ward, ward_id, ward_code, county_code,
centre_code, caw_code) via direct SQL JOINs before any API calls are made.

3-Tier Orphan Resolution for ward_code IS NULL:
  Tier 1: Exact match (already done in UAR, catches post-dedup stragglers)
  Tier 2: Single-ward constituency fallback
  Tier 3: pg_trgm similarity > 0.4 within same constituency
  Tier 4: HITL — export orphan_inspection.csv

Also normalizes centre_code via REGEXP_REPLACE join against iebc_registration_centres.
"""
import psycopg2
import os
import csv
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get("SUPABASE_DB_POOLED_URL")

try:
    # Log connection target (masking credentials)
    if db_url:
        from urllib.parse import urlparse
        parsed = urlparse(db_url)
        print(f"[ORPHAN] Connecting to {parsed.hostname}:{parsed.port or 5432} via {parsed.scheme}...")
        if parsed.port == 5432:
            print("[ORPHAN] WARNING: Using port 5432 (direct connection). If this is GitHub Actions, expect IPv6 routing issues.")

    conn = psycopg2.connect(db_url, connect_timeout=10)
    conn.autocommit = True
    cur = conn.cursor()

    print("=== ORPHAN RESOLVER — Step 0b ===\n")

    # ── PASS 1: ward / ward_id / ward_code (exact normalized match) ─────────
    cur.execute("""
        UPDATE public.iebc_offices AS t
        SET ward = w.ward_name,
            ward_id = w.id,
            ward_code = w.caw_code,
            updated_at = NOW()
        FROM public.wards w
        WHERE LOWER(TRIM(t.constituency)) = LOWER(TRIM(w.constituency))
          AND LOWER(TRIM(t.ward)) = LOWER(TRIM(w.ward_name))
          AND (t.ward_id IS NULL OR t.ward_code IS NULL)
    """)
    print(f"[PASS 1] Exact ward match: {cur.rowcount} updated.")

    # ── PASS 2: county_code ──────────────────────────────────────────────────
    cur.execute("""
        UPDATE public.iebc_offices AS t
        SET county_code = c.county_code,
            updated_at = NOW()
        FROM public.counties c
        WHERE LOWER(TRIM(t.county)) = LOWER(TRIM(c.name))
          AND t.county_code IS NULL
    """)
    print(f"[PASS 2] county_code: {cur.rowcount} updated.")

    # ── PASS 3: centre_code (normalized join — strip punct, lowercase, trim) ─
    cur.execute("""
        UPDATE public.iebc_offices AS t
        SET centre_code = r.centre_code,
            updated_at = NOW()
        FROM public.iebc_registration_centres r
        WHERE REGEXP_REPLACE(LOWER(TRIM(t.office_location)), '[^a-z0-9\s]', '', 'g')
            = REGEXP_REPLACE(LOWER(TRIM(r.name)), '[^a-z0-9\s]', '', 'g')
          AND LOWER(TRIM(t.constituency)) = LOWER(TRIM(r.constituency))
          AND LOWER(TRIM(t.county)) = LOWER(TRIM(r.county))
          AND t.centre_code IS NULL
          AND r.centre_code IS NOT NULL
    """)
    print(f"[PASS 3] centre_code (normalized): {cur.rowcount} updated.")

    # ── PASS 4: caw_code composite ───────────────────────────────────────────
    cur.execute("""
        UPDATE public.iebc_offices
        SET caw_code = ward_code || COALESCE(centre_code, '999'),
            updated_at = NOW()
        WHERE ward_code IS NOT NULL
          AND caw_code IS NULL
    """)
    print(f"[PASS 4] caw_code composite: {cur.rowcount} updated.")

    # ── ORPHAN TIER 1: Single-ward constituency ──────────────────────────────
    cur.execute("""
        UPDATE public.iebc_offices AS t
        SET ward_id = w.id,
            ward_code = w.caw_code,
            ward = w.ward_name,
            caw_code = w.caw_code || COALESCE(t.centre_code, '999'),
            updated_at = NOW()
        FROM public.wards w
        WHERE t.constituency = w.constituency
          AND (SELECT COUNT(*) FROM public.wards WHERE constituency = t.constituency) = 1
          AND t.ward_code IS NULL
    """)
    print(f"[ORPHAN T1] Single-ward constituency: {cur.rowcount} resolved.")

    # ── ORPHAN TIER 2: pg_trgm similarity > 0.4 ─────────────────────────────
    cur.execute("""
        UPDATE public.iebc_offices AS t
        SET ward_id = matched.wid,
            ward_code = matched.caw_code,
            ward = matched.ward_name,
            caw_code = matched.caw_code || COALESCE(t.centre_code, '999'),
            updated_at = NOW()
        FROM (
            SELECT DISTINCT ON (o.id)
                o.id,
                w.id AS wid,
                w.caw_code,
                w.ward_name,
                similarity(o.ward, w.ward_name) AS sim
            FROM public.iebc_offices o
            JOIN public.wards w ON LOWER(TRIM(o.constituency)) = LOWER(TRIM(w.constituency))
            WHERE o.ward_code IS NULL
              AND o.office_type = 'REGISTRATION_CENTRE'
              AND similarity(o.ward, w.ward_name) > 0.4
            ORDER BY o.id, similarity(o.ward, w.ward_name) DESC
        ) AS matched
        WHERE t.id = matched.id
    """)
    print(f"[ORPHAN T2] pg_trgm similarity: {cur.rowcount} resolved.")

    # ── ORPHAN TIER 3: HITL Export ───────────────────────────────────────────
    cur.execute("""
        SELECT id, office_location, ward, constituency, county, office_type, centre_code
        FROM public.iebc_offices
        WHERE ward_code IS NULL
          AND office_type = 'REGISTRATION_CENTRE'
        ORDER BY county, constituency
    """)
    hitl_rows = cur.fetchall()

    if hitl_rows:
        with open("scraper/orphan_inspection.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["id", "office_location", "ward", "constituency", "county",
                             "office_type", "centre_code", "action_required"])
            for row in hitl_rows:
                writer.writerow(list(row) + ["MANUAL: assign ward_code"])
        print(f"[ORPHAN T3] HITL export: {len(hitl_rows)} records -> scraper/orphan_inspection.csv")
    else:
        print("[ORPHAN T3] Zero unresolved orphans. 100% ward_code coverage achieved.")

    # ── FINAL AUDIT ───────────────────────────────────────────────────────────
    cur.execute("""
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE ward_code IS NOT NULL) as has_ward_code,
            COUNT(*) FILTER (WHERE county_code IS NOT NULL) as has_county_code,
            COUNT(*) FILTER (WHERE caw_code IS NOT NULL) as has_caw_code,
            COUNT(*) FILTER (WHERE centre_code IS NOT NULL) as has_centre_code
        FROM public.iebc_offices
        WHERE office_type = 'REGISTRATION_CENTRE'
    """)
    res = cur.fetchone()
    print(f"\n=== ADMINISTRATIVE BACKFILL AUDIT ===")
    print(f"  Total Centres:    {res[0]:,}")
    print(f"  ward_code:        {res[1]:,} ({100*res[1]/res[0]:.1f}%)")
    print(f"  county_code:      {res[2]:,} ({100*res[2]/res[0]:.1f}%)")
    print(f"  caw_code:         {res[3]:,} ({100*res[3]/res[0]:.1f}%)")
    print(f"  centre_code:      {res[4]:,} ({100*res[4]/res[0]:.1f}%)")

    conn.close()
    print("\n[ORPHAN RESOLVER] Step 0b complete.")

except Exception as e:
    print(f"[ORPHAN RESOLVER ERROR] {e}")
    import traceback
    traceback.print_exc()
