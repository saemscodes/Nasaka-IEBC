#!/usr/bin/env python3
"""
IEBC Office Geocoding Script with Nominatim
Geocodes constituency offices using OpenStreetMap Nominatim with caching
"""
import os
import time
import json
import pandas as pd
import requests
from pathlib import Path
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
from ratelimit import limits, sleep_and_retry
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# File paths
INPUT_CSV = Path("data/processed/cleaned_iebc_offices.csv")
OUTPUT_CSV = Path("data/processed/geocoded_iebc_offices.csv")
CACHE_FILE = Path("data/processed/geocode_cache.json")
MANUAL_REVIEW_FILE = Path("data/processed/manual_review_queue.csv")

# Kenya bounding box for validation
KENYA_BOUNDS = {
    "min_lat": -4.9, "max_lat": 5.0,
    "min_lon": 33.5, "max_lon": 42.0
}

# Load or initialize cache
if CACHE_FILE.exists():
    try:
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            cache = json.load(f)
        logger.info(f"Loaded cache with {len(cache)} entries")
    except Exception as e:
        logger.warning(f"Cache loading failed, starting fresh: {e}")
        cache = {}
else:
    cache = {}

def save_cache():
    """Save cache to file"""
    try:
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
        logger.info(f"Cache saved with {len(cache)} entries")
    except Exception as e:
        logger.error(f"Failed to save cache: {e}")

def validate_kenya_location(lat, lon):
    """Validate coordinates are within Kenya bounds"""
    if lat is None or lon is None:
        return False
    return (KENYA_BOUNDS["min_lat"] <= lat <= KENYA_BOUNDS["max_lat"] and 
            KENYA_BOUNDS["min_lon"] <= lon <= KENYA_BOUNDS["max_lon"])

@sleep_and_retry
@limits(calls=1, period=1)  # Nominatim requires 1 second between requests
def nominatim_geocode(query):
    """Geocode using OpenStreetMap Nominatim API"""
    url = "https://nominatim.openstreetmap.org/search"
    
    # Nominatim API parameters
    params = {
        "q": query,
        "format": "json",
        "countrycodes": "ke",  # Restrict to Kenya
        "limit": 1,
        "addressdetails": 1,
        "viewbox": "33.5,-4.9,42.0,5.0",  # Kenya bounding box
        "bounded": 1  # Restrict results to within viewbox
    }
    
    headers = {
        "User-Agent": "Recall254-VoterRegistration/1.0 (recall254.org)",
        "Accept-Language": "en"
    }
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        if data:
            result = data[0]
            # Calculate confidence based on result type and importance
            confidence = calculate_confidence(result)
            
            return {
                "lat": float(result["lat"]),
                "lon": float(result["lon"]),
                "address": result["display_name"],
                "confidence": confidence,
                "type": result.get("type", ""),
                "importance": result.get("importance", 0),
                "raw_result": result
            }
        return None
        
    except Exception as e:
        logger.warning(f"Nominatim geocoding failed for query '{query}': {e}")
        return None

def calculate_confidence(result):
    """Calculate confidence score based on Nominatim result"""
    base_confidence = result.get("importance", 0)
    result_type = result.get("type", "")
    
    # Adjust confidence based on result type
    type_boost = {
        "administrative": 0.9,
        "town": 0.8,
        "village": 0.7,
        "hamlet": 0.6,
        "suburb": 0.5,
        "road": 0.4,
        "building": 0.9
    }
    
    if result_type in type_boost:
        return min(0.95, (base_confidence + type_boost[result_type]) / 2)
    
    return base_confidence

@retry(
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type(requests.RequestException)
)
def geocode_with_nominatim(query):
    """Geocode using Nominatim with retry logic"""
    # Check cache first
    if query in cache:
        cached_result = cache[query]
        if cached_result.get("lat") and cached_result.get("lon"):
            logger.debug(f"Cache hit: {query}")
            return cached_result
    
    logger.info(f"Geocoding with Nominatim: {query}")
    result = None
    
    try:
        result = nominatim_geocode(query)
        if result and validate_kenya_location(result["lat"], result["lon"]):
            result["method"] = "nominatim"
            cache[query] = result
            save_cache()
            return result
    except Exception as e:
        logger.warning(f"Nominatim geocoding failed: {e}")
    
    # No results from Nominatim
    logger.warning(f"No geocoding results for: {query}")
    cache[query] = {"lat": None, "lon": None, "method": "manual", "address": None, "confidence": 0}
    save_cache()
    return cache[query]

def main():
    """Main geocoding function"""
    logger.info("Starting Nominatim geocoding process...")
    
    if not INPUT_CSV.exists():
        logger.error(f"Input file not found: {INPUT_CSV}")
        return
    
    try:
        df = pd.read_csv(INPUT_CSV)
        logger.info(f"Loaded {len(df)} rows for geocoding")
        
        # Initialize result columns
        df['latitude'] = None
        df['longitude'] = None
        df['geocode_method'] = None
        df['geocode_confidence'] = None
        df['formatted_address'] = None
        df['result_type'] = None
        df['importance_score'] = None
        
        successful_geocodes = 0
        failed_geocodes = 0
        
        for index, row in df.iterrows():
            query = row['geocode_query']
            
            try:
                result = geocode_with_nominatim(query)
                
                if result and result.get('lat') and result.get('lon'):
                    df.at[index, 'latitude'] = result['lat']
                    df.at[index, 'longitude'] = result['lon']
                    df.at[index, 'geocode_method'] = result.get('method', 'nominatim')
                    df.at[index, 'geocode_confidence'] = result.get('confidence', 0)
                    df.at[index, 'formatted_address'] = result.get('address', '')
                    df.at[index, 'result_type'] = result.get('type', '')
                    df.at[index, 'importance_score'] = result.get('importance', 0)
                    successful_geocodes += 1
                else:
                    failed_geocodes += 1
                
                # Progress logging
                if (index + 1) % 5 == 0:  # Reduced due to rate limiting
                    logger.info(f"Processed {index + 1}/{len(df)} rows...")
                    logger.info(f"Success: {successful_geocodes}, Failed: {failed_geocodes}")
                
                # Respect rate limits - 1 request per second
                time.sleep(1.1)  # Slightly more than 1 second to be safe
                
            except Exception as e:
                logger.error(f"Geocoding failed for row {index}: {e}")
                failed_geocodes += 1
                continue
        
        # Save results
        OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(OUTPUT_CSV, index=False, encoding='utf-8')
        
        # Create manual review queue for failed geocodes
        failed_df = df[df['latitude'].isna() | df['longitude'].isna()]
        if not failed_df.empty:
            MANUAL_REVIEW_FILE.parent.mkdir(parents=True, exist_ok=True)
            failed_df.to_csv(MANUAL_REVIEW_FILE, index=False, encoding='utf-8')
            logger.warning(f"Created manual review queue with {len(failed_df)} failed geocodes")
        
        logger.info(f"Geocoding completed: {successful_geocodes} successful, {failed_geocodes} failed")
        
        # Summary statistics
        confidence_stats = df['geocode_confidence'].describe()
        logger.info("Confidence score statistics:")
        logger.info(f"  Mean: {confidence_stats.get('mean', 0):.3f}")
        logger.info(f"  Min: {confidence_stats.get('min', 0):.3f}")
        logger.info(f"  Max: {confidence_stats.get('max', 0):.3f}")
        
        # Count by result type
        type_counts = df['result_type'].value_counts()
        logger.info("Result type distribution:")
        for result_type, count in type_counts.head(10).items():
            logger.info(f"  {result_type}: {count}")
            
    except Exception as e:
        logger.error(f"Geocoding process failed: {e}")
        raise

if __name__ == "__main__":
    main()
