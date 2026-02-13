#!/usr/bin/env python3
"""
COMPLETE IEBC Data Pipeline v2.0
Full PDF extraction -> Cleaning -> Multi-service Geocoding -> Database Ingestion
With Fallbacks, Caching, Batch Processing, Error Handling
"""

import os
import sys
import json
import logging
import pandas as pd
import pdfplumber
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dotenv import load_dotenv
from tenacity import retry, stop_after_attempt, wait_exponential
from ratelimit import limits, sleep_and_retry
import requests
from supabase import create_client, Client
from fuzzywuzzy import fuzz, process

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data/processed/iebc_pipeline.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
INPUT_PDF = Path("data/raw/Physical_Locations_of_County_and_Constituency_Offices_in_Kenya.pdf")
OUTPUT_DIR = Path("data/processed")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR = Path("data/outputs")
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

RAW_CSV = OUTPUT_DIR / "raw_iebc_offices.csv"
CLEANED_CSV = OUTPUT_DIR / "cleaned_iebc_offices.csv"
GEOCODED_CSV = OUTPUT_DIR / "geocoded_iebc_offices.csv"
FINAL_GEOJSON = OUTPUTS_DIR / "iebc_offices.geojson"
PIPELINE_REPORT = OUTPUT_DIR / "pipeline_report.json"

# API Keys
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
MAPBOX_API_KEY = os.getenv("MAPBOX_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

# Kenyan Counties (for validation)
KENYAN_COUNTIES = [
    "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu",
    "Garissa", "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho",
    "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui",
    "Kwale", "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera",
    "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi",
    "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri",
    "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi",
    "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"
]

class PDFExtractor:
    """Extract data from IEBC PDF"""
    
    def __init__(self, pdf_path: Path):
        self.pdf_path = pdf_path
        
    def extract_tables(self) -> List[Dict]:
        """Extract tables from PDF"""
        offices = []
        
        try:
            with pdfplumber.open(self.pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    logger.info(f"Processing page {page_num + 1}/{len(pdf.pages)}")
                    
                    tables = page.extract_tables()
                    for table in tables:
                        if not table or len(table) < 2:
                            continue
                        
                        headers = table[0]
                        if not headers:
                            continue
                        
                        for row in table[1:]:
                            if not row or len(row) < 3:
                                continue
                            
                            try:
                                office = self._parse_table_row(headers, row)
                                if office:
                                    offices.append(office)
                            except Exception as e:
                                logger.warning(f"Error parsing row: {e}")
                                continue
                    
                    text = page.extract_text()
                    if text:
                        text_offices = self._extract_from_text(text)
                        offices.extend(text_offices)
        
        except Exception as e:
            logger.error(f"Error extracting PDF: {e}")
            raise
        
        logger.info(f"Extracted {len(offices)} offices from PDF")
        return offices
    
    def _parse_table_row(self, headers: List, row: List) -> Optional[Dict]:
        """Parse a table row into office dict"""
        if len(row) < 3:
            return None
        
        office = {}
        for i, header in enumerate(headers):
            if i >= len(row):
                break
            if header and row[i]:
                header_clean = str(header).strip().lower()
                value = str(row[i]).strip()
                
                if 'county' in header_clean:
                    office['county'] = value
                elif 'constituency' in header_clean:
                    office['constituency_name'] = value
                    office['constituency'] = value
                elif 'location' in header_clean or 'office' in header_clean:
                    office['office_location'] = value
                elif 'landmark' in header_clean:
                    office['landmark'] = value
                elif 'code' in header_clean:
                    try:
                        office['constituency_code'] = int(value)
                    except:
                        pass
        
        if 'county' in office and 'office_location' in office:
            return office
        return None
    
    def _extract_from_text(self, text: str) -> List[Dict]:
        """Extract offices from unstructured text"""
        offices = []
        lines = text.split('\n')
        
        current_office = {}
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if any(county.lower() in line.lower() for county in KENYAN_COUNTIES):
                if current_office:
                    offices.append(current_office)
                current_office = {'county': line}
            elif 'constituency' in line.lower():
                current_office['constituency_name'] = line
                current_office['constituency'] = line
            elif len(line) > 10:
                if 'office_location' not in current_office:
                    current_office['office_location'] = line
                elif 'landmark' not in current_office:
                    current_office['landmark'] = line
        
        if current_office:
            offices.append(current_office)
        
        return offices

class DataCleaner:
    """Clean and validate extracted data"""
    
    def __init__(self):
        self.counties_map = {county.lower(): county for county in KENYAN_COUNTIES}
    
    def clean(self, offices: List[Dict]) -> List[Dict]:
        """Clean office data"""
        cleaned = []
        
        for office in offices:
            try:
                cleaned_office = self._clean_office(office)
                if cleaned_office:
                    cleaned.append(cleaned_office)
            except Exception as e:
                logger.warning(f"Error cleaning office: {e}")
                continue
        
        logger.info(f"Cleaned {len(cleaned)} offices from {len(offices)} raw")
        return cleaned
    
    def _clean_office(self, office: Dict) -> Optional[Dict]:
        """Clean a single office"""
        cleaned = {}
        
        county = office.get('county', '').strip()
        if county:
            county_matched = self._match_county(county)
            if county_matched:
                cleaned['county'] = county_matched
            else:
                logger.warning(f"Could not match county: {county}")
                return None
        else:
            return None
        
        constituency = office.get('constituency_name') or office.get('constituency', '').strip()
        if constituency:
            cleaned['constituency_name'] = constituency
            cleaned['constituency'] = constituency
        
        office_location = office.get('office_location', '').strip()
        if office_location:
            cleaned['office_location'] = office_location
            cleaned['clean_office_location'] = self._clean_location(office_location)
        else:
            return None
        
        landmark = office.get('landmark', '').strip()
        if landmark:
            cleaned['landmark'] = landmark
        
        constituency_code = office.get('constituency_code')
        if constituency_code:
            try:
                cleaned['constituency_code'] = int(constituency_code)
            except:
                pass
        
        cleaned['source'] = 'IEBC PDF - Physical Locations of County and Constituency Offices in Kenya'
        cleaned['created_at'] = datetime.now().isoformat()
        
        return cleaned
    
    def _match_county(self, county: str) -> Optional[str]:
        """Fuzzy match county name"""
        county_lower = county.lower()
        
        if county_lower in self.counties_map:
            return self.counties_map[county_lower]
        
        matched = process.extractOne(county, KENYAN_COUNTIES, scorer=fuzz.ratio)
        if matched and matched[1] >= 80:
            return matched[0]
        
        return None
    
    def _clean_location(self, location: str) -> str:
        """Clean location string"""
        location = location.replace('\n', ' ').replace('\r', ' ')
        location = ' '.join(location.split())
        return location

class Geocoder:
    """Multi-service geocoding with fallback"""
    
    def __init__(self):
        self.cache = {}
        self.stats = {
            'nominatim': 0,
            'google': 0,
            'mapbox': 0,
            'cached': 0,
            'failed': 0
        }
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    @sleep_and_retry
    @limits(calls=1, period=1)
    def geocode_nominatim(self, query: str) -> Optional[Dict]:
        """Geocode using Nominatim (free, rate-limited)"""
        try:
            url = "https://nominatim.openstreetmap.org/search"
            params = {
                'q': query,
                'format': 'json',
                'limit': 1,
                'countrycodes': 'ke',
                'addressdetails': 1
            }
            headers = {
                'User-Agent': 'IEBC-Data-Pipeline/1.0'
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if data and len(data) > 0:
                result = data[0]
                self.stats['nominatim'] += 1
                return {
                    'latitude': float(result['lat']),
                    'longitude': float(result['lon']),
                    'formatted_address': result.get('display_name', ''),
                    'geocode_method': 'nominatim',
                    'geocode_confidence': 0.8,
                    'geocode_service': 'OpenStreetMap Nominatim',
                    'result_type': result.get('type', ''),
                    'importance_score': result.get('importance', 0)
                }
        except Exception as e:
            logger.warning(f"Nominatim geocoding failed: {e}")
        
        return None
    
    @retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=1, max=5))
    def geocode_google(self, query: str) -> Optional[Dict]:
        """Geocode using Google Maps API"""
        if not GOOGLE_MAPS_API_KEY:
            return None
        
        try:
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                'address': query,
                'key': GOOGLE_MAPS_API_KEY,
                'region': 'ke'
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if data.get('status') == 'OK' and data.get('results'):
                result = data['results'][0]
                location = result['geometry']['location']
                self.stats['google'] += 1
                return {
                    'latitude': location['lat'],
                    'longitude': location['lng'],
                    'formatted_address': result.get('formatted_address', ''),
                    'geocode_method': 'google',
                    'geocode_confidence': result.get('geometry', {}).get('location_type') == 'ROOFTOP' and 0.95 or 0.85,
                    'geocode_service': 'Google Maps',
                    'result_type': result.get('types', [])[0] if result.get('types') else '',
                    'importance_score': 0.9
                }
        except Exception as e:
            logger.warning(f"Google geocoding failed: {e}")
        
        return None
    
    @retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=1, max=5))
    def geocode_mapbox(self, query: str) -> Optional[Dict]:
        """Geocode using Mapbox API"""
        if not MAPBOX_API_KEY:
            return None
        
        try:
            url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{requests.utils.quote(query)}.json"
            params = {
                'access_token': MAPBOX_API_KEY,
                'country': 'KE',
                'limit': 1
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if data.get('features') and len(data['features']) > 0:
                feature = data['features'][0]
                center = feature['center']
                self.stats['mapbox'] += 1
                return {
                    'latitude': center[1],
                    'longitude': center[0],
                    'formatted_address': feature.get('place_name', ''),
                    'geocode_method': 'mapbox',
                    'geocode_confidence': feature.get('relevance', 0.8),
                    'geocode_service': 'Mapbox',
                    'result_type': feature.get('place_type', [])[0] if feature.get('place_type') else '',
                    'importance_score': feature.get('relevance', 0)
                }
        except Exception as e:
            logger.warning(f"Mapbox geocoding failed: {e}")
        
        return None
    
    def geocode(self, office: Dict) -> Dict:
        """Geocode office with fallback chain"""
        query = self._build_query(office)
        query_hash = hash(query)
        
        if query_hash in self.cache:
            self.stats['cached'] += 1
            return {**office, **self.cache[query_hash]}
        
        result = None
        
        result = self.geocode_nominatim(query)
        if not result:
            result = self.geocode_google(query)
        if not result:
            result = self.geocode_mapbox(query)
        
        if result:
            self.cache[query_hash] = result
            return {**office, **result}
        else:
            self.stats['failed'] += 1
            logger.warning(f"All geocoding services failed for: {query}")
            return {**office, 'geocode_status': 'failed'}
    
    def _build_query(self, office: Dict) -> str:
        """Build geocoding query string"""
        parts = []
        
        if office.get('office_location'):
            parts.append(office['office_location'])
        if office.get('landmark'):
            parts.append(office['landmark'])
        if office.get('county'):
            parts.append(f"{office['county']} County")
        parts.append("Kenya")
        
        return ", ".join(parts)

class SupabaseIngester:
    """Ingest data to Supabase"""
    
    def __init__(self):
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("Supabase credentials not found in environment")
        
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    def ingest(self, offices: List[Dict], batch_size: int = 50) -> Dict:
        """Ingest offices to Supabase in batches"""
        total = len(offices)
        ingested = 0
        errors = 0
        
        for i in range(0, total, batch_size):
            batch = offices[i:i + batch_size]
            try:
                batch_prepared = [self._prepare_office(office) for office in batch]
                
                result = self.supabase.table('iebc_offices').upsert(
                    batch_prepared,
                    on_conflict='id'
                ).execute()
                
                ingested += len(batch)
                logger.info(f"Ingested batch {i//batch_size + 1}: {len(batch)} offices")
            except Exception as e:
                logger.error(f"Error ingesting batch: {e}")
                errors += len(batch)
        
        return {
            'total': total,
            'ingested': ingested,
            'errors': errors
        }
    
    def _prepare_office(self, office: Dict) -> Dict:
        """Prepare office dict for Supabase"""
        prepared = {
            'county': office.get('county'),
            'constituency': office.get('constituency'),
            'constituency_name': office.get('constituency_name'),
            'constituency_code': office.get('constituency_code'),
            'office_location': office.get('office_location'),
            'clean_office_location': office.get('clean_office_location'),
            'landmark': office.get('landmark'),
            'latitude': office.get('latitude'),
            'longitude': office.get('longitude'),
            'formatted_address': office.get('formatted_address'),
            'geocode_method': office.get('geocode_method'),
            'geocode_confidence': office.get('geocode_confidence'),
            'geocode_service': office.get('geocode_service'),
            'result_type': office.get('result_type'),
            'importance_score': office.get('importance_score'),
            'source': office.get('source'),
            'verified': False
        }
        
        if office.get('latitude') and office.get('longitude'):
            prepared['geom'] = f"POINT({office['longitude']} {office['latitude']})"
        
        return prepared

def create_geojson(offices: List[Dict], output_path: Path):
    """Create GeoJSON file from offices"""
    features = []
    
    for office in offices:
        if not office.get('latitude') or not office.get('longitude'):
            continue
        
        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [office['longitude'], office['latitude']]
            },
            'properties': {
                'id': office.get('id'),
                'county': office.get('county'),
                'constituency_name': office.get('constituency_name'),
                'constituency_code': str(office.get('constituency_code', '')).zfill(3),
                'office_location': office.get('office_location'),
                'landmark': office.get('landmark'),
                'formatted_address': office.get('formatted_address'),
                'geocode_method': office.get('geocode_method'),
                'geocode_confidence': office.get('geocode_confidence'),
                'geocode_service': office.get('geocode_service'),
                'verified': office.get('verified', False),
                'source': office.get('source')
            }
        }
        features.append(feature)
    
    geojson = {
        'type': 'FeatureCollection',
        'features': features
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Created GeoJSON with {len(features)} features")

def main():
    """Main pipeline execution"""
    logger.info("=" * 80)
    logger.info("IEBC DATA PIPELINE v2.0 - STARTING")
    logger.info("=" * 80)
    
    start_time = datetime.now()
    report = {
        'started_at': start_time.isoformat(),
        'phases': {}
    }
    
    try:
        # PHASE 1: Extract from PDF
        logger.info("\n[PHASE 1] PDF EXTRACTION")
        extractor = PDFExtractor(INPUT_PDF)
        raw_offices = extractor.extract_tables()
        
        df_raw = pd.DataFrame(raw_offices)
        df_raw.to_csv(RAW_CSV, index=False)
        logger.info(f"Saved {len(raw_offices)} raw offices to {RAW_CSV}")
        
        report['phases']['extraction'] = {
            'offices_extracted': len(raw_offices),
            'output_file': str(RAW_CSV)
        }
        
        # PHASE 2: Clean data
        logger.info("\n[PHASE 2] DATA CLEANING")
        cleaner = DataCleaner()
        cleaned_offices = cleaner.clean(raw_offices)
        
        df_cleaned = pd.DataFrame(cleaned_offices)
        df_cleaned.to_csv(CLEANED_CSV, index=False)
        logger.info(f"Saved {len(cleaned_offices)} cleaned offices to {CLEANED_CSV}")
        
        report['phases']['cleaning'] = {
            'offices_cleaned': len(cleaned_offices),
            'output_file': str(CLEANED_CSV)
        }
        
        # PHASE 3: Geocode
        logger.info("\n[PHASE 3] GEOCODING")
        geocoder = Geocoder()
        geocoded_offices = []
        
        for i, office in enumerate(cleaned_offices):
            logger.info(f"Geocoding {i+1}/{len(cleaned_offices)}: {office.get('office_location', 'Unknown')}")
            geocoded = geocoder.geocode(office)
            geocoded_offices.append(geocoded)
        
        df_geocoded = pd.DataFrame(geocoded_offices)
        df_geocoded.to_csv(GEOCODED_CSV, index=False)
        logger.info(f"Saved {len(geocoded_offices)} geocoded offices to {GEOCODED_CSV}")
        logger.info(f"Geocoding stats: {geocoder.stats}")
        
        report['phases']['geocoding'] = {
            'offices_geocoded': len(geocoded_offices),
            'stats': geocoder.stats,
            'output_file': str(GEOCODED_CSV)
        }
        
        # PHASE 4: Create GeoJSON
        logger.info("\n[PHASE 4] GEOJSON GENERATION")
        create_geojson(geocoded_offices, FINAL_GEOJSON)
        
        report['phases']['geojson'] = {
            'output_file': str(FINAL_GEOJSON)
        }
        
        # PHASE 5: Ingest to Supabase
        logger.info("\n[PHASE 5] DATABASE INGESTION")
        ingester = SupabaseIngester()
        ingestion_result = ingester.ingest(geocoded_offices)
        
        logger.info(f"Ingestion complete: {ingestion_result['ingested']}/{ingestion_result['total']} offices")
        
        report['phases']['ingestion'] = ingestion_result
        
        # Final report
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        report['completed_at'] = end_time.isoformat()
        report['duration_seconds'] = duration
        report['success'] = True
        
        with open(PIPELINE_REPORT, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info("\n" + "=" * 80)
        logger.info("PIPELINE COMPLETED SUCCESSFULLY")
        logger.info(f"Duration: {duration:.2f} seconds")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"Pipeline failed: {e}", exc_info=True)
        report['success'] = False
        report['error'] = str(e)
        report['completed_at'] = datetime.now().isoformat()
        
        with open(PIPELINE_REPORT, 'w') as f:
            json.dump(report, f, indent=2)
        
        sys.exit(1)

if __name__ == "__main__":
    main()
