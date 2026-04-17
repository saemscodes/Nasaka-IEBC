"""
extract_wards.py
Reads kenya_wards shapefile and extracts all ward+constituency data,
then uses psycopg2 to seed the wards table with any missing entries.
"""
import shapefile
import json
import os
import sys
import urllib.request
import urllib.parse
import urllib.error

SHP_PATH = r"D:\CEKA\NASAKA\NASAKA CONTEXT\KENYA\WARDS\Kenya_Wards\kenya_wards"

def read_wards():
    print("[SHP] Reading shapefile...")
    sf = shapefile.Reader(SHP_PATH)
    fields = [f[0] for f in sf.fields[1:]]  # skip DeletionFlag
    print(f"[SHP] Fields: {fields}")
    
    records = []
    for sr in sf.shapeRecords():
        rec = dict(zip(fields, sr.record))
        records.append(rec)
    
    print(f"[SHP] Total records: {len(records)}")
    print(f"[SHP] Sample: {records[:3]}")
    return records, fields

if __name__ == "__main__":
    records, fields = read_wards()
    # Output unique constituency names for debugging
    consts = sorted(set(r.get('CONSTITUEN', r.get('CONST_NAME', r.get('Constituen', ''))) for r in records))
    wards = sorted(set(r.get('WARD_NAME', r.get('Ward_Name', r.get('NAME', ''))) for r in records))
    print(f"\n[SHP] Unique Constituencies ({len(consts)}): {consts[:20]}")
    print(f"\n[SHP] Sample Ward Names: {wards[:20]}")
    
    # Save full extract for inspection
    with open("scraper/ward_extract.json", "w", encoding="utf-8") as f:
        json.dump(records[:5], f, indent=2, default=str)
    print("\n[SHP] Sample saved to scraper/ward_extract.json")
