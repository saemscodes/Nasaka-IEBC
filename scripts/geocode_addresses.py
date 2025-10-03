#!/usr/bin/env python3
"""
IEBC Office Geocoding Script
Geocodes constituency offices using multiple providers with caching
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

# API Keys from environment
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
MAPBOX_API_KEY = os.getenv("MAPBOX_API_KEY")

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

# Rate limiting decorators
@sleep_and_retry
@limits(calls=50, period=60)  # Google Geocoding API limits
def google_geocode(query):
    """Geocode using Google Maps API"""
    if not GOOGLE_API_KEY:
        raise ValueError("Google API key not configured")
    
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": query,
        "key": GOOGLE_API_KEY,
        "region": "ke",  # Kenya bias
        "bounds": "|-4.9,33.5|5.0,42.0"  # Kenya bounding box
    }
    
    response = requests.get(url, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()
    
    if data["status"] == "OK" and data["results"]:
        location = data["results"][0]["geometry"]["location"]
        return {
            "lat": location["lat"],
            "lon": location["lng"],
            "address": data["results"][0]["formatted_address"],
            "confidence": 0.9
        }
    elif data["status"] == "ZERO_RESULTS":
        return None
    else:
        logger.warning(f"Google Geocoding API error: {data.get('status')} for query: {query}")
        return None

@sleep_and_retry
@limits(calls=60, period=60)  # Mapbox limits
def mapbox_geocode(query):
    """Geocode using Mapbox API"""
    if not MAPBOX_API_KEY:
        raise ValueError("Mapbox API key not configured")
    
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{requests.utils.requote_uri(query)}.json"
    params = {
        "access_token": MAPBOX_API_KEY,
        "country": "ke",
        "limit": 1,
        "types": "address,place,poi"
    }
    
    response = requests.get(url, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()
    
    if data["features"]:
        feature = data["features"][0]
        lon, lat = feature["center"]
        return {
            "lat": lat,
            "lon": lon,
            "address": feature["place_name"],
            "confidence": feature.get("relevance", 0.7)
        }
    return None

@sleep_and_retry
@limits(calls=1, period=1)  # Nominatim requires 1 second between requests
def nominatim_geocode(query):
    """Geocode using OpenStreetMap Nominatim"""
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": query,
        "format": "json",
        "countrycodes": "ke",
        "limit": 1,
        "addressdetails": 1
    }
    headers = {
        "User-Agent": "Recall254-VoterRegistration/1.0 (recall254.org)"
    }
    
    response = requests.get(url, params=params, headers=headers, timeout=15)
    response.raise_for_status()
    data = response.json()
    
    if data:
        result = data[0]
        return {
            "lat": float(result["lat"]),
            "lon": float(result["lon"]),
            "address": result["display_name"],
            "confidence": 0.6
        }
    return None

@retry(
    wait=wait_exponential(multiplier=1, min=4, max=10),
    stop=stop_after_attempt(3),
    retry=retry_if_exception_type(requests.RequestException)
)
def geocode_with_providers(query):
    """Geocode using multiple providers with fallback"""
    # Check cache first
    if query in cache:
        cached_result = cache[query]
        if cached_result.get("lat") and cached_result.get("lon"):
            logger.debug(f"Cache hit: {query}")
            return cached_result
    
    logger.info(f"Geocoding: {query}")
    result = None
    
    # Try providers in order of preference
    if GOOGLE_API_KEY:
        try:
            result = google_geocode(query)
            if result and validate_kenya_location(result["lat"], result["lon"]):
                result["method"] = "google"
                cache[query] = result
                save_cache()
                return result
        except Exception as e:
            logger.warning(f"Google geocoding failed: {e}")
    
    if MAPBOX_API_KEY and not result:
        try:
            result = mapbox_geocode(query)
            if result and validate_kenya_location(result["lat"], result["lon"]):
                result["method"] = "mapbox"
                cache[query] = result
                save_cache()
                return result
        except Exception as e:
            logger.warning(f"Mapbox geocoding failed: {e}")
    
    # Fallback to Nominatim
    try:
        result = nominatim_geocode(query)
        if result and validate_kenya_location(result["lat"], result["lon"]):
            result["method"] = "nominatim"
            cache[query] = result
            save_cache()
            return result
    except Exception as e:
        logger.warning(f"Nominatim geocoding failed: {e}")
    
    # No results from any provider
    logger.warning(f"No geocoding results for: {query}")
    cache[query] = {"lat": None, "lon": None, "method": "failed", "address": None, "confidence": 0}
    save_cache()
    return cache[query]

def main():
    """Main geocoding function"""
    logger.info("Starting geocoding process...")
    
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
        
        successful_geocodes = 0
        failed_geocodes = 0
        
        for index, row in df.iterrows():
            query = row['geocode_query']
            
            try:
                result = geocode_with_providers(query)
                
                if result and result.get('lat') and result.get('lon'):
                    df.at[index, 'latitude'] = result['lat']
                    df.at[index, 'longitude'] = result['lon']
                    df.at[index, 'geocode_method'] = result.get('method', 'unknown')
                    df.at[index, 'geocode_confidence'] = result.get('confidence', 0)
                    df.at[index, 'formatted_address'] = result.get('address', '')
                    successful_geocodes += 1
                else:
                    failed_geocodes += 1
                
                # Progress logging
                if (index + 1) % 10 == 0:
                    logger.info(f"Processed {index + 1}/{len(df)} rows...")
                
                # Small delay to be respectful to APIs
                time.sleep(0.1)
                
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
        method_counts = df['geocode_method'].value_counts()
        logger.info("Geocoding method distribution:")
        for method, count in method_counts.items():
            logger.info(f"  {method}: {count}")
            
    except Exception as e:
        logger.error(f"Geocoding process failed: {e}")
        raise

if __name__ == "__main__":
    main()