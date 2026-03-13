
import re

def normalize_county(name: str) -> str:
    n = name.strip().upper()
    n = re.sub(r"\s+COUNTY\s*$", "", n)
    return n

def reproduce_bug():
    expected_county = "KAJIADO"
    
    # Mock query_candidates from different sources
    query_candidates = [
        {"source": "photon", "county_from_api": "Kajiado County", "lat": -1.8, "lng": 37.0},
        {"source": "locationiq", "county_from_api": "", "lat": -1.81, "lng": 37.01},
        {"source": "geokeo", "county_from_api": "", "lat": -1.82, "lng": 37.02}
    ]
    
    all_candidates = []
    rejected = []
    
    print(f"Expected County: {expected_county}")
    print("-" * 50)
    
    for c in query_candidates:
        api_county = normalize_county(c.get("county_from_api", ""))
        exp_county = normalize_county(expected_county)
        
        # This is the logic at line 1125 in resolve_coordinates.py
        if api_county and (api_county == exp_county or exp_county in api_county or api_county in exp_county):
            print(f"OK ACCEPTED {c['source']}: api_county='{api_county}'")
            all_candidates.append(c)
        else:
            print(f"ERR REJECTED {c['source']}: api_county='{api_county}'")
            c["rejection_reason"] = f"County mismatch: got {api_county}, expected {exp_county}"
            rejected.append(c)
            
    print("-" * 50)
    print(f"Candidates in all_candidates (to be further validated): {[x['source'] for x in all_candidates]}")
    print(f"Candidates in rejected list: {[x['source'] for x in rejected]}")
    
    # The second validation block starts with:
    # for c in all_candidates:
    # So items in 'rejected' are NEVER checked for reverse geocoding!

if __name__ == "__main__":
    reproduce_bug()
