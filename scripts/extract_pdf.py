#!/usr/bin/env python3
"""
IEBC PDF Data Extraction Script
Extracts constituency office data from IEBC PDF into structured CSV
"""
import pdfplumber
import re
import csv
import sys
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
PDF_PATH = Path("data/raw/Physical_Locations_of_County_and_Constituency_Offices_in_Kenya.pdf")
OUTPUT_CSV = Path("data/processed/raw_iebc_offices.csv")
COLUMN_HEADERS = ["county", "constituency_code", "constituency_name", "office_location", "landmark", "distance_from_landmark"]

def normalize_whitespace(text):
    """Normalize whitespace in text"""
    if not text or str(text).strip() == '':
        return ''
    return re.sub(r'\s+', ' ', str(text)).strip()

def extract_table_from_page(page):
    """Extract table data from a single PDF page"""
    try:
        # Extract text with layout preservation
        text = page.extract_text(layout=True, x_tolerance=2, y_tolerance=2)
        if not text:
            return []
        
        lines = [normalize_whitespace(line) for line in text.split('\n') if normalize_whitespace(line)]
        rows = []
        
        current_row = {}
        buffer_line = ""
        
        for line in lines:
            # Skip headers and page numbers
            if any(header in line.lower() for header in ['county', 'constituency', 'office location', 'page', 'independent electoral']):
                continue
            
            # Look for pattern: County, Code, Constituency Name pattern
            pattern = r'^([A-Za-z\s\-]+)\s+(\d{1,3})\s+([A-Za-z0-9\s\-\.\/\(\)\&]+?)(?:\s{2,}|$)(.*)$'
            match = re.match(pattern, line)
            
            if match:
                # If we have a buffered row, save it first
                if current_row:
                    rows.append(current_row)
                    current_row = {}
                
                county = normalize_whitespace(match.group(1))
                code = match.group(2).zfill(3)
                constituency = normalize_whitespace(match.group(3))
                remaining = normalize_whitespace(match.group(4))
                
                # Parse remaining parts (office location, landmark, distance)
                remaining_parts = re.split(r'\s{2,}', remaining)
                office_location = remaining_parts[0] if remaining_parts else ""
                landmark = remaining_parts[1] if len(remaining_parts) > 1 else ""
                distance = remaining_parts[2] if len(remaining_parts) > 2 else ""
                
                current_row = {
                    "county": county,
                    "constituency_code": code,
                    "constituency_name": constituency,
                    "office_location": office_location,
                    "landmark": landmark,
                    "distance_from_landmark": distance
                }
                buffer_line = ""
                
            elif current_row and buffer_line:
                # Continue building the current row with additional lines
                combined = f"{buffer_line} {line}"
                remaining_parts = re.split(r'\s{2,}', combined)
                
                if len(remaining_parts) >= 3:
                    current_row["office_location"] = remaining_parts[0]
                    current_row["landmark"] = remaining_parts[1]
                    current_row["distance_from_landmark"] = remaining_parts[2] if len(remaining_parts) > 2 else ""
                    buffer_line = ""
                else:
                    buffer_line = combined
            else:
                buffer_line = line if not buffer_line else f"{buffer_line} {line}"
        
        # Don't forget the last row
        if current_row:
            rows.append(current_row)
            
        return rows
        
    except Exception as e:
        logger.error(f"Error processing page: {e}")
        return []

def main():
    """Main extraction function"""
    logger.info("Starting IEBC PDF extraction...")
    
    if not PDF_PATH.exists():
        logger.error(f"PDF file not found: {PDF_PATH}")
        sys.exit(1)
    
    all_rows = []
    
    try:
        with pdfplumber.open(PDF_PATH) as pdf:
            total_pages = len(pdf.pages)
            logger.info(f"Processing {total_pages} pages...")
            
            for page_num, page in enumerate(pdf.pages, 1):
                logger.info(f"Processing page {page_num}/{total_pages}")
                page_rows = extract_table_from_page(page)
                all_rows.extend(page_rows)
                logger.info(f"Extracted {len(page_rows)} rows from page {page_num}")
        
        # Write to CSV
        OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
        
        with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=COLUMN_HEADERS)
            writer.writeheader()
            for row in all_rows:
                writer.writerow(row)
        
        logger.info(f"Successfully extracted {len(all_rows)} total rows to {OUTPUT_CSV}")
        
        # Print summary
        unique_constituencies = len(set(row['constituency_code'] for row in all_rows))
        logger.info(f"Unique constituencies: {unique_constituencies}")
        
    except Exception as e:
        logger.error(f"PDF processing failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()