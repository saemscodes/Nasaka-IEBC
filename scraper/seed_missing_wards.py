"""
seed_missing_wards_v2.py

Uses DIRECT Postgres connection to bypass RLS.
STEP 1: Already done (null caw_codes cleared)
STEP 2: Seed 708 missing wards from shapefile via pg
STEP 3: Report + trigger mapper
"""
import shapefile
import os
import sys
import json
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_URL   = os.environ.get("SUPABASE_DB_POOLED_URL") or os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
SHP_PATH = r"D:\CEKA\NASAKA\NASAKA CONTEXT\KENYA\WARDS\Kenya_Wards\kenya_wards"

if not DB_URL:
    print("[FATAL] No DB_URL found in .env"); sys.exit(1)

def norm_title(s):
    return (s or "").strip().title()

def strip_suffix(s, suffixes):
    s = s.strip()
    for suf in suffixes:
        if s.endswith(suf):
            s = s[:-len(suf)].strip()
    return s

def norm_constituency(subcounty):
    s = norm_title(subcounty)
    s = strip_suffix(s, [" Sub County", " Subcounty", " Sub-County"])
    return s

def norm_ward(ward):
    s = norm_title(ward)
    s = strip_suffix(s, [" Ward"])
    return s

print("[SHP] Reading shapefile...")
sf = shapefile.Reader(SHP_PATH)
fields = [f[0] for f in sf.fields[1:]]
records = [dict(zip(fields, sr.record)) for sr in sf.shapeRecords()]
print(f"  Total shapefile records: {len(records)}")

# Build unique ward+constituency+county tuples
shp_wards = {}
for rec in records:
    county        = norm_title(str(rec.get("county", "")))
    constituency  = norm_constituency(str(rec.get("subcounty", "")))
    ward_name     = norm_ward(str(rec.get("ward", "")))
    if ward_name and constituency and county:
        key = f"{county.upper()}|{constituency.upper()}|{ward_name.upper()}"
        shp_wards[key] = {
            "county":        county,
            "constituency":  constituency,
            "ward_name":     ward_name,
        }

print(f"  Unique shapefile county|constituency|ward: {len(shp_wards)}")

# Connect directly via Postgres
print("\n[PG] Connecting to Postgres...")
conn = psycopg2.connect(DB_URL)
conn.autocommit = True
cur = conn.cursor()

# Fetch existing from wards table
cur.execute("SELECT ward_name, constituency, county FROM public.wards")
existing = cur.fetchall()
existing_keys = set()
for (wn, cons, cnty) in existing:
    k = f"{(cnty or '').strip().upper()}|{(cons or '').strip().upper()}|{(wn or '').strip().upper()}"
    existing_keys.add(k)

print(f"  Existing wards in DB: {len(existing_keys)}")
missing = {k: v for k, v in shp_wards.items() if k not in existing_keys}
print(f"  Missing wards to insert: {len(missing)}")

if not missing:
    print("  ✓ Ward table is already complete!")
else:
    print("\n[PG] Seeding missing wards directly...")
    count = 0
    for key, w in missing.items():
        try:
            cur.execute(
                """INSERT INTO public.wards (ward_name, constituency, county)
                   VALUES (%s, %s, %s)
                   ON CONFLICT DO NOTHING""",
                (w["ward_name"], w["constituency"], w["county"])
            )
            count += 1
            sys.stdout.write(f"  ✓ Seeded {count}/{len(missing)}\r")
            sys.stdout.flush()
        except Exception as e:
            print(f"\n  [ERR] {w}: {e}")
    print(f"\n  ✓ Done! Seeded {count} wards.")

# Final verify
cur.execute("""
    SELECT 
        (SELECT COUNT(*) FROM public.wards) as total_wards,
        (SELECT COUNT(*) FROM public.iebc_offices WHERE office_type='REGISTRATION_CENTRE') as total_centres,
        (SELECT COUNT(*) FROM public.iebc_offices WHERE office_type='REGISTRATION_CENTRE' AND caw_code IS NULL) as orphans,
        (SELECT COUNT(*) FROM public.iebc_offices WHERE office_type='REGISTRATION_CENTRE' AND (caw_code LIKE 'null%')) as false_pos
""")
row = cur.fetchone()
print(f"\n[FINAL STATUS]")
print(f"  Total wards in DB:    {row[0]}")
print(f"  Total centres:        {row[1]}")
print(f"  True orphans:         {row[2]}  ({100*row[2]/row[1]:.1f}%)")
print(f"  False positives:      {row[3]}")
print(f"\n[READY] Run: npx ts-node scraper/ham-final-mapping.ts")

cur.close()
conn.close()
