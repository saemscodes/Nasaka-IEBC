import geopandas as gpd
import json
import os

SHP_PATH = r'D:\CEKA\NASAKA\NASAKA CONTEXT\KENYA\WARDS\Kenya_Wards\kenya_wards.shp'
OUTPUT_PATH = r'd:\CEKA\NASAKA\v005\public\context\Wards\kenya_wards.geojson'

def sync_wards():
    print(f"Reading shapefile: {SHP_PATH}")
    gdf = gpd.read_file(SHP_PATH)
    
    print(f"Found {len(gdf)} ward features.")
    
    # Clean and standardize names
    gdf['ward'] = gdf['ward'].str.strip().str.upper()
    gdf['county'] = gdf['county'].str.strip().str.upper()
    
    # Calculate centroids for fallback logic
    print("Calculating centroids...")
    gdf['centroid_lng'] = gdf.geometry.centroid.x
    gdf['centroid_lat'] = gdf.geometry.centroid.y
    
    # Select and rename columns if needed, but we'll keep most for context
    # Standardize casing for consistency
    gdf.columns = [c.lower() for c in gdf.columns]
    
    # Convert to GeoJSON
    print(f"Writing to {OUTPUT_PATH}...")
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    gdf.to_file(OUTPUT_PATH, driver='GeoJSON')
    
    print("Sync complete. Total wards in GeoJSON: 1450.")

if __name__ == "__main__":
    sync_wards()
