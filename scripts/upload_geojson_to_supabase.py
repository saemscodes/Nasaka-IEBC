#!/usr/bin/env python3
"""
IEBC GeoJSON Upload Script
Uploads generated GeoJSON files to Supabase storage for production access
"""
import os
import requests
from pathlib import Path
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
GEOJSON_FILE = Path('data/outputs/iebc_offices.geojson')
BUCKET_NAME = 'map-data'
FILE_NAME = 'iebc_offices.geojson'

def upload_to_supabase_storage():
    """Upload GeoJSON file to Supabase storage"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        logger.error("Supabase configuration missing")
        return False
    
    if not GEOJSON_FILE.exists():
        logger.error(f"GeoJSON file not found: {GEOJSON_FILE}")
        return False
    
    try:
        # Read the GeoJSON file
        with open(GEOJSON_FILE, 'r', encoding='utf-8') as f:
            file_content = f.read()
        
        # Upload to Supabase storage
        headers = {
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
            'Content-Type': 'application/geo+json'
        }
        
        upload_url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{FILE_NAME}"
        
        response = requests.post(
            upload_url,
            headers=headers,
            data=file_content.encode('utf-8')
        )
        
        if response.status_code == 200:
            logger.info(f"Successfully uploaded {FILE_NAME} to Supabase storage")
            logger.info(f"Public URL: {upload_url}")
            return True
        else:
            logger.error(f"Upload failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Upload process failed: {e}")
        return False

def main():
    """Main upload function"""
    logger.info("Starting GeoJSON upload to Supabase...")
    
    if upload_to_supabase_storage():
        logger.info("IEBC offices GeoJSON is now available for frontend consumption")
    else:
        logger.error("Failed to upload GeoJSON to Supabase storage")

if __name__ == "__main__":
    main()
