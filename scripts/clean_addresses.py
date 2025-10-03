#!/usr/bin/env python3
"""
IEBC Data Cleaning Script
Cleans and standardizes constituency office data
"""
import pandas as pd
import re
from fuzzywuzzy import process, fuzz
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# File paths
INPUT_CSV = Path("data/processed/raw_iebc_offices.csv")
OUTPUT_CSV = Path("data/processed/cleaned_iebc_offices.csv")

# Canonical Kenyan counties (47 counties)
CANONICAL_COUNTIES = [
    "Mombasa", "Kwale", "Kilifi", "Tana River", "Lamu", "Taita Taveta", "Garissa",
    "Wajir", "Mandera", "Marsabit", "Isiolo", "Meru", "Tharaka Nithi", "Embu",
    "Kitui", "Machakos", "Makueni", "Nyandarua", "Nyeri", "Kirinyaga", "Murang'a",
    "Kiambu", "Turkana", "West Pokot", "Samburu", "Trans Nzoia", "Uasin Gishu",
    "Elgeyo Marakwet", "Nandi", "Baringo", "Laikipia", "Nakuru", "Narok", "Kajiado",
    "Kericho", "Bomet", "Kakamega", "Vihiga", "Bungoma", "Busia", "Siaya",
    "Kisumu", "Homa Bay", "Migori", "Kisii", "Nyamira", "Nairobi"
]

# County name corrections
COUNTY_CORRECTIONS = {
    "Kirili": "Kirifi",
    "Marshall": "Marsabit", 
    "Talia Taveta": "Taita Taveta",
    "Thanaka": "Tharaka Nithi",
    "Erribu": "Embu",
    "Kirtai": "Kitui",
    "Nyandama": "Nyandarua",
    "Kambu": "Kiambu",
    "Makuru": "Nakuru",
    "Narcék": "Narok",
    "Bornet": "Bomet",
    "Kitumu": "Kisumu",
    "Myanmar": "Nyamira",
    "Narooli City": "Nairobi"
}

def canonicalize_county(county_name):
    """Convert county names to canonical form"""
    if pd.isna(county_name) or not str(county_name).strip():
        return ""
    
    county_name = str(county_name).strip()
    
    # First check direct corrections
    if county_name in COUNTY_CORRECTIONS:
        return COUNTY_CORRECTIONS[county_name]
    
    # Try exact match
    if county_name in CANONICAL_COUNTIES:
        return county_name
    
    # Fuzzy matching for close matches
    best_match, score = process.extractOne(county_name, CANONICAL_COUNTIES, scorer=fuzz.token_sort_ratio)
    if score >= 85:
        return best_match
    
    # Return original if no good match found
    return county_name

def clean_constituency_name(name):
    """Clean and standardize constituency names"""
    if pd.isna(name) or not str(name).strip():
        return ""
    
    name = str(name).strip()
    
    # Common corrections
    corrections = {
        "Jomyu": "Jomvu",
        "Kisami": "Kisauni",
        "Ildoni": "Likoni",
        "Myita": "Mvita",
        "Masanbeeni": "Msambweni",
        "Mutuga": "Matuga",
        "Kalokori": "Kaloleni",
        "Babai": "Baba Dogo",
        "Gante": "Ganze",
        "Bulindi": "Bura",
        "Magazini": "Magarini",
        "Sarisen": "Bura",
        "Galoka": "Galole",
        "Bara": "Bura"
    }
    
    if name in corrections:
        return corrections[name]
    
    # Title case and clean
    name = name.title()
    name = re.sub(r'\s+', ' ', name)
    
    return name

def clean_office_data(df):
    """Main data cleaning function"""
    logger.info("Starting data cleaning process...")
    
    # Ensure all columns are strings and handle NaN
    for col in df.columns:
        df[col] = df[col].astype(str).replace({'nan': '', 'None': ''})
        df[col] = df[col].str.strip()
    
    # Clean county names
    logger.info("Cleaning county names...")
    df['county'] = df['county'].apply(canonicalize_county)
    
    # Clean constituency names
    logger.info("Cleaning constituency names...")
    df['constituency_name'] = df['constituency_name'].apply(clean_constituency_name)
    
    # Standardize distance format
    logger.info("Standardizing distance formats...")
    df['distance_from_landmark'] = df['distance_from_landmark'].apply(lambda x: re.sub(r'(\d)\s*(m|M|meters?|metres?)', r'\1m', str(x)))
    df['distance_from_landmark'] = df['distance_from_landmark'].apply(lambda x: re.sub(r'(\d)\s*(km|Km|kilometers?)', r'\1 km', str(x)))
    
    # Create geocoding query
    logger.info("Creating geocoding queries...")
    df['geocode_query'] = df.apply(
        lambda row: f"{row['office_location']}, {row['constituency_name']}, {row['county']} County, Kenya", 
        axis=1
    )
    
    # Remove empty queries
    initial_count = len(df)
    df = df[df['geocode_query'].str.len() > 10].copy()
    final_count = len(df)
    
    logger.info(f"Removed {initial_count - final_count} empty rows, {final_count} rows remaining")
    
    return df

def main():
    """Main cleaning function"""
    logger.info("Loading raw data...")
    
    if not INPUT_CSV.exists():
        logger.error(f"Input file not found: {INPUT_CSV}")
        return
    
    try:
        df = pd.read_csv(INPUT_CSV)
        logger.info(f"Loaded {len(df)} raw rows")
        
        cleaned_df = clean_office_data(df)
        
        # Save cleaned data
        OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
        cleaned_df.to_csv(OUTPUT_CSV, index=False, encoding='utf-8')
        
        logger.info(f"Successfully cleaned {len(cleaned_df)} rows to {OUTPUT_CSV}")
        
        # Print summary
        county_summary = cleaned_df['county'].value_counts()
        logger.info("County distribution:")
        for county, count in county_summary.head(10).items():
            logger.info(f"  {county}: {count}")
            
    except Exception as e:
        logger.error(f"Data cleaning failed: {e}")
        raise

if __name__ == "__main__":
    main()