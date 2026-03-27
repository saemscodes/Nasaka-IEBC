#!/usr/bin/env python3
"""
Generate standard Android drawables (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi)
from one or more source images.

Enhancements:
- --output-name: specify a fixed output filename (e.g., splash.png) for all generated files.
- --png-compress: set PNG compression level (0-9, default 9) for smaller files.
- --optimize: enable PNG optimizer (slightly reduces size).
- --verbose: quiet mode (only errors)
- --skip-existing: skip drawable folders where file already exists
- Full error handling for invalid image files
- Preserves original code structure and logic
"""

import os
import sys
import argparse
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Error: The 'Pillow' library is not installed.")
    print("Please install it by running: pip install Pillow")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(
        description="Generate standard Android drawables (mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi) from one or more source images.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    # Required positional argument for the source images (one or more)
    parser.add_argument(
        "sources", 
        nargs="+", 
        help="Path(s) to the source image file(s) (e.g., source.png logo.png)."
    )
    
    # Optional argument for the target res directory
    parser.add_argument(
        "--res", 
        default=r"D:\CEKA\NASAKA\v005\android\app\src\main\res", 
        help="Path to the Android app 'res' directory where drawable folders reside."
    )
    
    # Optional argument defining which density the original source is mapped to
    parser.add_argument(
        "--base-density",
        choices=["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"],
        default="xxxhdpi",
        help="The density scale that the input source represents. Default is 'xxxhdpi', meaning the source image will be scaled down for all smaller densities."
    )
    
    # Enhancement: verbosity control
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print detailed progress messages. If not set, only warnings and errors are shown."
    )
    
    # Enhancement: skip existing files
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Do not overwrite existing drawables in the target folders."
    )
    
    # New: fixed output filename (e.g., splash.png)
    parser.add_argument(
        "--output-name",
        default=None,
        help="Use this name (with .png extension) for all generated files instead of the source filename."
    )
    
    # New: PNG compression level (0-9, 9 is best compression)
    parser.add_argument(
        "--png-compress",
        type=int,
        choices=range(0, 10),
        default=9,
        help="PNG compression level (0 = no compression, 9 = maximum compression)."
    )
    
    # New: enable PNG optimizer (additional size reduction)
    parser.add_argument(
        "--optimize",
        action="store_true",
        help="Enable PNG optimizer (may reduce file size further)."
    )

    args = parser.parse_args()
    
    # DENSITIES maps density name to its Android scale factor relative to mdpi (1.0)
    densities_map = {
        "mdpi": 1.0,
        "hdpi": 1.5,
        "xhdpi": 2.0,
        "xxhdpi": 3.0,
        "xxxhdpi": 4.0
    }
    
    # Explicit dimensions for standard Android orientations/splash screens
    splash_dimensions = {
        "land-mdpi": (480, 320),
        "land-hdpi": (800, 480),
        "land-xhdpi": (1280, 720),
        "land-xxhdpi": (1600, 960),
        "land-xxxhdpi": (1920, 1280),
        "port-mdpi": (320, 480),
        "port-hdpi": (480, 800),
        "port-xhdpi": (720, 1280),
        "port-xxhdpi": (960, 1600),
        "port-xxxhdpi": (1280, 1920),
    }
    
    base_scale = densities_map[args.base_density]
    res_path = Path(args.res)
    
    # Ensure the root res directory exists
    if not res_path.exists():
        try:
            res_path.mkdir(parents=True, exist_ok=True)
            if args.verbose:
                print(f"Created base res directory: {res_path}")
        except Exception as e:
            print(f"Failed to create res directory '{res_path}': {e}")
            sys.exit(1)
    
    # Warn if using output-name with multiple sources
    if args.output_name and len(args.sources) > 1:
        print("Warning: Using --output-name with multiple source files will overwrite the same output file for each source.")
    
    # Process each source image provided
    for source in args.sources:
        source_path = Path(source)
        
        if not source_path.exists() or not source_path.is_file():
            print(f"Warning: Source file '{source}' does not exist or is not a file. Skipping.")
            continue
        
        # Check if it is a valid image file
        try:
            with Image.open(source_path) as test_img:
                test_img.verify()  # Verify it's a valid image
        except Exception:
            print(f"Warning: '{source}' is not a valid image file. Skipping.")
            continue
            
        if args.verbose:
            print(f"\nProcessing: {source_path.name}")
        
        try:
            with Image.open(source_path) as img:
                # Convert to RGBA to preserve transparency securely in PNG output
                img = img.convert("RGBA")
                original_width, original_height = img.size
                
                if args.verbose:
                    print(f"  Source Resolution: {original_width}x{original_height} (Mapped to {args.base_density})")
                
                # Base dimensions (the equivalent mdpi size at 1.0 scale)
                base_width = original_width / base_scale
                base_height = original_height / base_scale
                
                # Determine output filename: either user-provided or from source
                if args.output_name:
                    # Ensure .png extension
                    output_base_name = Path(args.output_name).with_suffix('.png').name
                else:
                    output_base_name = source_path.with_suffix('.png').name
                
                # Generate scaled variations for each density factor
                for density_name, scale in densities_map.items():
                    # Calculate target dimensions (minimum 1 pixel)
                    target_width = max(1, int(base_width * scale))
                    target_height = max(1, int(base_height * scale))
                    
                    # Create the target drawable folder (e.g. drawable-mdpi)
                    folder_name = f"drawable-{density_name}"
                    folder_path = res_path / folder_name
                    folder_path.mkdir(parents=True, exist_ok=True)
                    
                    # Use LANCZOS (high-quality downsampling/upsampling algorithm) 
                    resized_img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                    
                    # Save the scaled image
                    output_file_path = folder_path / output_base_name
                    
                    # Enhancement: skip if file exists and --skip-existing is set
                    if args.skip_existing and output_file_path.exists():
                        if args.verbose:
                            print(f"  - {folder_name:<16} -> file exists, skipping ({output_file_path})")
                        continue
                    
                    resized_img.save(
                        output_file_path,
                        format="PNG",
                        compress_level=args.png_compress,
                        optimize=args.optimize
                    )
                    if args.verbose:
                        print(f"  - {folder_name:<16} -> {target_width}x{target_height}  ({output_file_path})")
                
                # Additive: Generate explicit splash/orientation drawables
                for splash_name, (target_width, target_height) in splash_dimensions.items():
                    folder_name = f"drawable-{splash_name}"
                    folder_path = res_path / folder_name
                    folder_path.mkdir(parents=True, exist_ok=True)
                    
                    resized_img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
                    
                    output_file_path = folder_path / output_base_name
                    
                    if args.skip_existing and output_file_path.exists():
                        if args.verbose:
                            print(f"  - {folder_name:<16} -> file exists, skipping ({output_file_path})")
                        continue
                    
                    resized_img.save(
                        output_file_path,
                        format="PNG",
                        compress_level=args.png_compress,
                        optimize=args.optimize
                    )
                    if args.verbose:
                        print(f"  - {folder_name:<16} -> {target_width}x{target_height}  ({output_file_path})")
                        
        except Exception as e:
            print(f"Error processing '{source}': {e}")

    if args.verbose:
        print("\nAll tasks completed successfully!")

if __name__ == "__main__":
    main()