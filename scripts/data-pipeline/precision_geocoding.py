import os
import geopandas as gpd
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv
from fuzzywuzzy import fuzz
from fuzzywuzzy import process
import re

# Load environment variables
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── Configuration ────────────────────────────────────────────────────────────
SCHOOLS_SHP = "data/raw/schools/Schools/Schools.shp"
HOTOSM_SHP = "data/raw/hotosm/hotosm_ken_education_facilities_points_shp.shp"

# ─── Helper Functions ─────────────────────────────────────────────────────────

def normalize_name(name):
    if not name:
        return ""
    # Remove common prefixes/suffixes
    name = name.upper()
    name = re.sub(r'\b(PRIMARY|SECONDARY|SCHOOL|SCH|SEC|PRI|ACADEMY|ACAD)\b', '', name)
    name = re.sub(r'[^A-Z0-0\s]', '', name)
    return " ".join(name.split())

def match_names(name1, name2, threshold=85):
    if not name1 or not name2:
        return 0
    return fuzz.token_sort_ratio(normalize_name(name1), normalize_name(name2))

# ─── Precision Geocoding Pipeline ─────────────────────────────────────────────

def run_pipeline():
    print("🚀 Starting Precision Geocoding Pipeline...")

    # 1. Load Shapefiles
    print("Loading Schools shapefile...")
    schools_gdf = gpd.read_file(SCHOOLS_SHP)
    # Convert to 4326 if not already
    if schools_gdf.crs != "EPSG:4326":
        schools_gdf = schools_gdf.to_crs("EPSG:4326")
    
    print("Loading HOTOSM shapefile...")
    hotosm_gdf = gpd.read_file(HOTOSM_SHP)
    if hotosm_gdf.crs != "EPSG:4326":
        hotosm_gdf = hotosm_gdf.to_crs("EPSG:4326")

    # 2. Fetch IEBC Centres from Supabase
    print("Fetching centres from Supabase...")
    all_centres = []
    batch_size = 1000
    from_row = 0
    
    while True:
        print(f"Fetching batch from {from_row} to {from_row + batch_size - 1}...")
        response = supabase.table("iebc_offices").select("id, office_location, clean_office_location, county, constituency_name, latitude, longitude, office_type").range(from_row, from_row + batch_size - 1).execute()
        data = response.data
        if not data:
            print("No more data found.")
            break
        print(f"Received {len(data)} records.")
        all_centres.extend(data)
        from_row += len(data) # Accurate increment
        # If we didn't get any data, the loop breaks above
        # If we got exactly 0, it breaks
        # We only stop if data is empty to be sure
        if len(all_centres) >= 30422: # Safety break if we know the total
             break
            
    centres = all_centres
    print(f"Found {len(centres)} centres.")

    updates = []
    matches_found = 0

    # 3. Perform Matching via Spatial Join (Faster)
    print("Performing spatial join matching...")
    
    if not centres:
        print("No centres to process. Exiting.")
        return

    # Convert centres to GeoDataFrame (using centroid lat/lng)
    centres_df = pd.DataFrame(centres)
    print(f"Centres DataFrame Sample:\n{centres_df.head(2)}")
    
    # Ensure latitude and longitude are numeric and not null
    centres_df['latitude'] = pd.to_numeric(centres_df['latitude'], errors='coerce')
    centres_df['longitude'] = pd.to_numeric(centres_df['longitude'], errors='coerce')
    centres_df = centres_df.dropna(subset=['latitude', 'longitude'])
    
    centres_gdf = gpd.GeoDataFrame(
        centres_df, 
        geometry=gpd.points_from_xy(centres_df.longitude, centres_df.latitude),
        crs="EPSG:4326"
    )

    # 3. Handle Hierarchical Fallback (Fixing Corrupted UTM)
    print("Handling hierarchical fallback...")
    
    # Separate offices (centroids) and centres (targets)
    offices_df = pd.DataFrame([c for c in centres if c.get("office_type") == "CONSTITUENCY_OFFICE"])
    centres_df = pd.DataFrame([c for c in centres if c.get("office_type") == "REGISTRATION_CENTRE"])
    
    if offices_df.empty:
        print("Warning: No constituency offices found for centroids. Using raw centres.")
        targets_df = pd.DataFrame(centres)
    else:
        # Create a mapping of constituency_name -> (lat, lng)
        centroid_map = offices_df.groupby("constituency_name")[["latitude", "longitude"]].first().to_dict("index")
        
        # Apply centroids to centres with corrupted coordinates
        def fix_coords(row):
            if pd.isna(row["longitude"]) or row["longitude"] > 180 or row["longitude"] < -180:
                parent = centroid_map.get(row["constituency_name"])
                if parent:
                    return pd.Series([parent["latitude"], parent["longitude"]])
            return pd.Series([row["latitude"], row["longitude"]])
            
        centres_df[["latitude", "longitude"]] = centres_df.apply(fix_coords, axis=1)
        targets_df = centres_df

    # Convert targets to GeoDataFrame
    targets_df = targets_df.dropna(subset=["latitude", "longitude"])
    targets_gdf = gpd.GeoDataFrame(
        targets_df, 
        geometry=gpd.points_from_xy(targets_df.longitude, targets_df.latitude),
        crs="EPSG:4326"
    )

    # Convert Schools to WGS84
    schools_gdf = schools_gdf.to_crs("EPSG:4326")
    hotosm_gdf = hotosm_gdf.to_crs("EPSG:4326")

    print(f"Performing spatial matching for {len(targets_gdf)} centres...")
    
    # Spatial Join: Find 3 nearest schools for each centre (within 5km approx)
    # We use a distance constraint to stop matching to schools in other counties
    print("Finding nearest matches in Schools.shp...")
    matched_schools = gpd.sjoin_nearest(targets_gdf, schools_gdf, distance_col="distance", how="left", max_distance=0.05) # ~5.5km
    
    print("Finding nearest matches in HOTOSM...")
    matched_hotosm = gpd.sjoin_nearest(targets_gdf, hotosm_gdf, distance_col="distance", how="left", max_distance=0.05)

    updates = []
    
    for idx, row in targets_gdf.iterrows():
        centre_id = row["id"]
        centre_name = row.get("clean_office_location") or row.get("office_location")
        
        # Candidate 1: Schools.shp
        school_match = matched_schools[matched_schools["id"] == centre_id]
        best_school_score = 0
        best_school_geom = None
        
        for _, match_row in school_match.iterrows():
            if pd.isna(match_row["SCHOOL_NAM"]): continue
            score = match_names(centre_name, match_row["SCHOOL_NAM"])
            if score > best_school_score:
                best_school_score = score
                best_school_geom = schools_gdf.loc[match_row.index_right].geometry

        # Candidate 2: HOTOSM
        osm_match = matched_hotosm[matched_hotosm["id"] == centre_id]
        best_osm_score = 0
        best_osm_geom = None
        
        for _, match_row in osm_match.iterrows():
            if pd.isna(match_row["name"]): continue
            score = match_names(centre_name, match_row["name"])
            if score > best_osm_score:
                best_osm_score = score
                best_osm_geom = hotosm_gdf.loc[match_row.index_right].geometry

        # Selection Logic
        final_lat, final_lng, final_score, method = None, None, 0, ""
        
        if best_school_score >= 85:
            final_lat, final_lng = best_school_geom.y, best_school_geom.x
            final_score, method = best_school_score, "schools_shp_precision"
        elif best_osm_score >= 85:
            final_lat, final_lng = best_osm_geom.y, best_osm_geom.x
            final_score, method = best_osm_score, "hotosm_precision"
        elif best_school_score >= 60: # Secondary confidence
            final_lat, final_lng = best_school_geom.y, best_school_geom.x
            final_score, method = best_school_score, "schools_shp_fuzzy"

        if final_lat:
            updates.append({
                "id": int(centre_id),
                "latitude": final_lat,
                "longitude": final_lng,
                "geom": f"SRID=4326;POINT({final_lng} {final_lat})", # Direct PostGIS Update
                "county": row["county"], # Fix: satisfy triggers
                "constituency_name": row["constituency_name"], # Fix: satisfy triggers
                "office_location": row["office_location"], # Fix: satisfy NOT NULL
                "office_type": row["office_type"], # Fix: satisfy NOT NULL
                "geocode_method": method,
                "geocode_confidence": final_score / 100.0,
                "verified": True
            })

    # 4. Batch Updates
    print(f"Batching {len(updates)} precision updates to Supabase...")
    batch_size = 100
    for i in range(0, len(updates), batch_size):
        batch = updates[i:i+batch_size]
        try:
            supabase.table("iebc_offices").upsert(batch).execute()
            if i % 1000 == 0: print(f"Upgraded {i} registration centres...")
        except Exception as e:
            print(f"Error in batch {i}: {e}")

    print(f"✅ Pipeline complete. Resolved {len(updates)} precision locations.")

if __name__ == "__main__":
    run_pipeline()
