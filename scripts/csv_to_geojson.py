#!/usr/bin/env python3
"""
IEBC GeoJSON Conversion Script
Converts geocoded CSV data to GeoJSON format
"""
import pandas as pd
import json
from pathlib import Path
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# File paths
INPUT_CSV = Path("data/processed/geocoded_iebc_offices.csv")
OUTPUT_GEOJSON = Path("data/outputs/iebc_offices.geojson")

def create_geojson_features(df):
    """Create GeoJSON features from DataFrame"""
    features = []
    
    for _, row in df.iterrows():
        # Skip rows without coordinates
        if pd.isna(row.get('latitude')) or pd.isna(row.get('longitude')):
            continue
            
        # Create properties
        properties = {
            "constituency_code": str(row.get('constituency_code', '')).zfill(3),
            "constituency_name": row.get('constituency_name', ''),
            "county": row.get('county', ''),
            "office_location": row.get('office_location', ''),
            "landmark": row.get('landmark', ''),
            "distance_from_landmark": row.get('distance_from_landmark', ''),
            "source": "IEBC PDF - Physical Locations of County and Constituency Offices in Kenya",
            "geocode_method": row.get('geocode_method', 'unknown'),
            "geocode_confidence": float(row.get('geocode_confidence', 0)) if pd.notna(row.get('geocode_confidence')) else 0,
            "formatted_address": row.get('formatted_address', ''),
            "verified": False,
            "last_updated": datetime.now().isoformat(),
            "notes": ""
        }
        
        # Create geometry
        geometry = {
            "type": "Point",
            "coordinates": [
                float(row['longitude']),
                float(row['latitude'])
            ]
        }
        
        # Create feature
        feature = {
            "type": "Feature",
            "properties": properties,
            "geometry": geometry
        }
        
        features.append(feature)
    
    return features

def main():
    """Main conversion function"""
    logger.info("Starting GeoJSON conversion...")
    
    if not INPUT_CSV.exists():
        logger.error(f"Input file not found: {INPUT_CSV}")
        return
    
    try:
        # Load data
        df = pd.read_csv(INPUT_CSV)
        logger.info(f"Loaded {len(df)} rows")
        
        # Filter out rows without coordinates
        valid_df = df[(df['latitude'].notna()) & (df['longitude'].notna())].copy()
        logger.info(f"Found {len(valid_df)} rows with valid coordinates")
        
        # Create GeoJSON structure
        features = create_geojson_features(valid_df)
        
        geojson = {
            "type": "FeatureCollection",
            "name": "IEBC Constituency Offices in Kenya",
            "description": "Physical locations of IEBC constituency offices for voter registration",
            "metadata": {
                "source": "Independent Electoral and Boundaries Commission (IEBC)",
                "extracted_from": "Physical_Locations_of_County_and_Constituency_Offices_in_Kenya.pdf",
                "generated_on": datetime.now().isoformat(),
                "total_offices": len(features),
                "coordinate_system": "WGS84 (EPSG:4326)"
            },
            "features": features
        }
        
        # Save GeoJSON
        OUTPUT_GEOJSON.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_GEOJSON, 'w', encoding='utf-8') as f:
            json.dump(geojson, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Successfully created GeoJSON with {len(features)} features at {OUTPUT_GEOJSON}")
        
        # Print summary
        county_summary = valid_df['county'].value_counts()
        logger.info("Office distribution by county:")
        for county, count in county_summary.head(15).items():
            logger.info(f"  {county}: {count}")
            
        method_summary = valid_df['geocode_method'].value_counts()
        logger.info("Geocoding method summary:")
        for method, count in method_summary.items():
            logger.info(f"  {method}: {count}")
            
    except Exception as e:
        logger.error(f"GeoJSON conversion failed: {e}")
        raise

if __name__ == "__main__":
    main()