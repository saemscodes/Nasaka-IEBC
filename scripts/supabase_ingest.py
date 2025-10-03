#!/usr/bin/env python3
"""
IEBC Supabase Database Ingestion Script
Upserts geocoded office data into Supabase PostgreSQL database
"""
import os
import json
import pandas as pd
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# File paths
GEOJSON_FILE = Path("data/outputs/iebc_offices.geojson")

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def init_supabase() -> Client:
    """Initialize Supabase client"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise ValueError("Supabase URL and Service Key must be set in environment variables")
    
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def transform_geojson_to_records(geojson_data):
    """Transform GeoJSON features to database records"""
    records = []
    
    for feature in geojson_data.get('features', []):
        properties = feature.get('properties', {})
        geometry = feature.get('geometry', {})
        
        if geometry.get('type') != 'Point' or not geometry.get('coordinates'):
            continue
        
        lon, lat = geometry['coordinates']
        
        record = {
            'constituency_code': properties.get('constituency_code', ''),
            'constituency_name': properties.get('constituency_name', ''),
            'county': properties.get('county', ''),
            'office_location': properties.get('office_location', ''),
            'landmark': properties.get('landmark', ''),
            'distance_from_landmark': properties.get('distance_from_landmark', ''),
            'source': properties.get('source', ''),
            'geocode_method': properties.get('geocode_method', ''),
            'geocode_confidence': float(properties.get('geocode_confidence', 0)),
            'formatted_address': properties.get('formatted_address', ''),
            'verified': properties.get('verified', False),
            'notes': properties.get('notes', ''),
            'geom': f'POINT({lon} {lat})'
        }
        
        records.append(record)
    
    return records

def upsert_offices(supabase: Client, records):
    """Upsert office records into database"""
    if not records:
        logger.warning("No records to upsert")
        return 0
    
    try:
        # Use upsert with on_conflict to handle duplicates
        response = supabase.table('iebc_offices').upsert(
            records,
            on_conflict='constituency_code,office_location'
        ).execute()
        
        if hasattr(response, 'data'):
            return len(response.data)
        else:
            logger.error("Upsert response missing data attribute")
            return 0
            
    except Exception as e:
        logger.error(f"Upsert failed: {e}")
        # Fallback: try individual inserts
        successful = 0
        for record in records:
            try:
                response = supabase.table('iebc_offices').upsert(
                    record,
                    on_conflict='constituency_code,office_location'
                ).execute()
                successful += 1
            except Exception as individual_error:
                logger.error(f"Failed to upsert record {record.get('constituency_code')}: {individual_error}")
        
        return successful

def main():
    """Main ingestion function"""
    logger.info("Starting database ingestion...")
    
    if not GEOJSON_FILE.exists():
        logger.error(f"GeoJSON file not found: {GEOJSON_FILE}")
        return
    
    try:
        # Load GeoJSON data
        with open(GEOJSON_FILE, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        
        logger.info(f"Loaded GeoJSON with {len(geojson_data.get('features', []))} features")
        
        # Transform data
        records = transform_geojson_to_records(geojson_data)
        logger.info(f"Transformed {len(records)} records for database")
        
        if not records:
            logger.warning("No valid records to insert")
            return
        
        # Initialize Supabase client
        supabase = init_supabase()
        logger.info("Supabase client initialized")
        
        # Upsert records in batches to avoid timeouts
        batch_size = 50
        total_upserted = 0
        
        for i in range(0, len(records), batch_size):
            batch = records[i:i + batch_size]
            logger.info(f"Upserting batch {i//batch_size + 1}/{(len(records)-1)//batch_size + 1} ({len(batch)} records)")
            
            upserted = upsert_offices(supabase, batch)
            total_upserted += upserted
            
            logger.info(f"Batch upserted: {upserted} records")
        
        logger.info(f"Database ingestion completed: {total_upserted} records upserted")
        
        # Verify counts
        try:
            response = supabase.table('iebc_offices').select('id', count='exact').execute()
            total_count = getattr(response, 'count', 0)
            logger.info(f"Total offices in database: {total_count}")
        except Exception as e:
            logger.warning(f"Could not verify total count: {e}")
            
    except Exception as e:
        logger.error(f"Database ingestion failed: {e}")
        raise

if __name__ == "__main__":
    main()