#!/usr/bin/env python3
"""
IEBC Data Validation Script
Validates the quality and completeness of processed IEBC office data
"""
import pandas as pd
import json
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# File paths
GEOJSON_FILE = Path("data/outputs/iebc_offices.geojson")
VALIDATION_REPORT = Path("data/processed/validation_report.json")

def validate_geojson_data(geojson_data):
    """Comprehensive GeoJSON validation"""
    validation_results = {
        "total_offices": 0,
        "valid_coordinates": 0,
        "missing_data": {},
        "quality_metrics": {},
        "issues": []
    }
    
    if not geojson_data.get('features'):
        validation_results["issues"].append("No features found in GeoJSON")
        return validation_results
    
    features = geojson_data['features']
    validation_results["total_offices"] = len(features)
    
    required_fields = ['constituency_code', 'constituency_name', 'county', 'office_location']
    missing_counts = {field: 0 for field in required_fields}
    
    valid_coords_count = 0
    confidence_scores = []
    
    for i, feature in enumerate(features):
        properties = feature.get('properties', {})
        geometry = feature.get('geometry', {})
        
        # Check required fields
        for field in required_fields:
            if not properties.get(field):
                missing_counts[field] += 1
        
        # Validate coordinates
        coords = geometry.get('coordinates', [])
        if (len(coords) == 2 and 
            -180 <= coords[0] <= 180 and -90 <= coords[1] <= 90 and
            33.5 <= coords[0] <= 42.0 and -4.9 <= coords[1] <= 5.0):  # Kenya bounds
            valid_coords_count += 1
        
        # Collect confidence scores
        confidence = properties.get('geocode_confidence', 0)
        if confidence:
            confidence_scores.append(float(confidence))
    
    validation_results["valid_coordinates"] = valid_coords_count
    validation_results["missing_data"] = missing_counts
    
    # Quality metrics
    validation_results["quality_metrics"] = {
        "coordinate_completeness": valid_coords_count / len(features),
        "field_completeness": {
            field: 1 - (missing_counts[field] / len(features))
            for field in required_fields
        },
        "average_confidence": sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0,
        "verified_count": sum(1 for f in features if f.get('properties', {}).get('verified', False))
    }
    
    # Identify issues
    if valid_coords_count < len(features):
        validation_results["issues"].append(f"{len(features) - valid_coords_count} offices have invalid coordinates")
    
    for field, count in missing_counts.items():
        if count > 0:
            validation_results["issues"].append(f"{count} offices missing {field}")
    
    if validation_results["quality_metrics"]["average_confidence"] < 0.7:
        validation_results["issues"].append("Low average geocoding confidence")
    
    return validation_results

def main():
    """Main validation function"""
    logger.info("Starting data validation...")
    
    if not GEOJSON_FILE.exists():
        logger.error(f"GeoJSON file not found: {GEOJSON_FILE}")
        return
    
    try:
        with open(GEOJSON_FILE, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
        
        validation_results = validate_geojson_data(geojson_data)
        
        # Save validation report
        VALIDATION_REPORT.parent.mkdir(parents=True, exist_ok=True)
        with open(VALIDATION_REPORT, 'w', encoding='utf-8') as f:
            json.dump(validation_results, f, indent=2, ensure_ascii=False)
        
        # Print summary
        logger.info("=== VALIDATION SUMMARY ===")
        logger.info(f"Total offices: {validation_results['total_offices']}")
        logger.info(f"Valid coordinates: {validation_results['valid_coordinates']}")
        logger.info(f"Average confidence: {validation_results['quality_metrics']['average_confidence']:.2%}")
        logger.info(f"Verified offices: {validation_results['quality_metrics']['verified_count']}")
        
        if validation_results['issues']:
            logger.warning("ISSUES FOUND:")
            for issue in validation_results['issues']:
                logger.warning(f"  - {issue}")
        else:
            logger.info("✓ No major issues found")
        
        logger.info(f"Detailed report saved to: {VALIDATION_REPORT}")
        
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        raise

if __name__ == "__main__":
    main()