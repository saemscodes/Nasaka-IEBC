#!/bin/bash
# GOHAM API Security Verification Script
# Tests the "Strictly Strict" tiering and dynamic pricing of the Nasaka IEBC API.

BASE_URL="http://localhost:3000/api/v1/main" # Update to your local dev URL if different

echo "--- 1. Testing No API Key (Public Guest Bypass Check) ---"
curl -s -X GET "${BASE_URL}?route=offices&county=MOMBASA&limit=100" | jq '.meta, .data | length'
# EXPECTED: Meta showing 'public' tier, truncated to 5 results, filters ignored/limited.

echo -e "\n--- 2. Testing Invalid API Key (Security Check) ---"
curl -s -X GET "${BASE_URL}?route=offices" -H "X-API-Key: nsk_live_INVALID_TOKEN" | jq '.'
# EXPECTED: 403 Forbidden with "Invalid or deactivated API key".

echo -e "\n--- 3. Testing Dynamic Pricing (Peak Hour/Weight Check) ---"
# We'll use a dummy key that exists in your DB for this test if possible,
# or look at the response meta of a valid key.
curl -s -X GET "${BASE_URL}?route=boundary&lat=-1.28&lng=36.82" -H "X-API-Key: $YOUR_KEY" | jq '.meta'
# EXPECTED: Weighted cost should be > 1.0 (Boundary is 10.0 + Peak Multiplier).

echo -e "\n--- 4. Testing Strict Parameter Forwarding (Mombasa/Nandi Fix) ---"
curl -s -X GET "${BASE_URL}?route=offices&county=MOMBASA&limit=1" -H "X-API-Key: $YOUR_KEY" | jq '.data[0].county'
# EXPECTED: "MOMBASA"

echo -e "\n--- 5. Testing Exhaustive Logging ---"
echo "Check Supabase table 'nasaka_usage_log' for entries with 'search_params' column populated."
