#!/bin/bash

# Production Build Script for Recall254 IEBC Voter Registration

echo "🚀 Starting Recall254 Production Build..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run data pipeline to generate latest GeoJSON
echo "🔄 Running data pipeline..."
npm run data:pipeline

# Upload GeoJSON to Supabase
echo "📤 Uploading GeoJSON to Supabase..."
python scripts/upload_geojson_to_supabase.py

# Build the application
echo "🏗️ Building production application..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo "📁 Output: dist/"
    echo "🌐 You can now deploy the 'dist' folder to your web server"
else
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi
