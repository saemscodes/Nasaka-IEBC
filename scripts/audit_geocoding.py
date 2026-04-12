import shapefile
from fuzzywuzzy import process, fuzz

SCHOOLS_SHP = r"d:\CEKA\NASAKA\v005\data\raw\schools\Schools\Schools.shp"
HOTOSM_SHP = r"d:\CEKA\NASAKA\v005\data\raw\hotosm\hotosm_ken_education_facilities_points_shp.shp"

def audit_matches(test_names, county_filter=None):
    sf = shapefile.Reader(SCHOOLS_SHP)
    fields = [f[0] for f in sf.fields[1:]]
    records = []
    for rec in sf.records():
        r = dict(zip(fields, rec))
        if county_filter and r.get('County', '').upper() != county_filter.upper():
            continue
        records.append(r.get('SCHOOL_NAM', '').upper())
    
    print(f"Auditing {len(test_names)} names against {len(records)} schools in {county_filter or 'ALL'}")
    for name in test_names:
        match, score = process.extractOne(name, records, scorer=fuzz.token_sort_ratio)
        print(f"QUERY: {name} -> MATCH: {match} (SCORE: {score})")

# Sample failed names from logs
test_names = [
    "KISUMU NDOGO GROUND",
    "TUBERE VILLAGE CENTRE BOBAY BOREHOLE",
    "DABELEY ECD CENTREEDHEREY ECD CENTRE",
    "LAAGO MOBILE",
    "NYAMBENE PRIMARY SCHOOL",
    "CHANGAMWE SECONDARY"
]

audit_matches(test_names, "MOMBASA")
audit_matches(test_names, "MERU")
