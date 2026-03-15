# Nasaka IEBC B2B Public API Master Specification

This document serves as the single source of truth for the Nasaka IEBC Public API (v1). All endpoints are deployed as Vercel Edge Functions and are designed for high performance and scalability.

## Base URL
`https://nasakaiebc.civiceducationkenya.com/api/v1`

## Authentication
Most endpoints are public. For write-access or higher rate limits, include an `X-API-Key` header.
- **Header:** `X-API-Key: your_api_key_here`

---

## 1. System Stats
Returns high-level aggregation of the IEBC office dataset.

- **Endpoint:** `/stats`
- **Method:** `GET`
- **Response:**
```json
{
  "data": {
    "total_stations": 290,
    "verified_count": 195,
    "coordinate_coverage": 290,
    "coordinate_coverage_pct": 100,
    "verified_coverage_pct": 67,
    "counties_covered": 47,
    "snapshot_timestamp": "2026-03-15T..."
  }
}
```

## 2. County Directory
Lists all 47 counties with registration targets and office counts.

- **Endpoint:** `/counties`
- **Method:** `GET`
- **Parameters:** None
- **Response:** Returns list of county objects with registration metadata.

## 3. Office Registry
Queryable list of all 290 constituency offices.

- **Endpoint:** `/offices`
- **Method:** `GET`
- **Query Params:**
  - `county`: Filter by county name (partial match)
  - `constituency`: Filter by constituency name (partial match)
  - `verified`: `true` or `false`
  - `limit`: Default 50, Max 200
  - `offset`: For pagination

## 4. Office Detail
Get full metadata for a specific office.

- **Endpoint:** `/offices/:id`
- **Method:** `GET`

## 5. Polling Station Locator (NEW)
Accepts coordinates or names and returns the nearest verified offices.

- **Endpoint:** `/locate`
- **Method:** `GET`
- **Query Params:**
  - `lat`, `lng`: Geolocation filter
  - `radius`: Distance in km (default 25)
  - `constituency`, `ward`, `county`: Name-based filter
- **Features:** Computes live Haversine distance for coordinate queries.

## 6. Voter Registration Status (NEW)
Returns operational status and capacity data.

- **Endpoint:** `/status`
- **Method:** `GET`
- **Status Types:** `verified_active`, `verified`, `located_unverified`, `location_unconfirmed`.

## 7. Constituency Boundary Lookup (NEW)
Reverse lookup to find administrative context for a point.

- **Endpoint:** `/boundary`
- **Method:** `GET`
- **Query Params:** `lat`, `lng`
- **Returns:** County, Constituency, MP Name, Party, and nearby registration centers.

## 8. Verified Coordinate Dataset (NEW)
Export the cleaned coordinate dataset for developers.

- **Endpoint:** `/coordinates`
- **Method:** `GET`
- **Formats:** JSON (default), `?format=geojson`, `?format=csv`.

## 9. System Health
Monitoring endpoint for the API gateway.

- **Endpoint:** `/health`
- **Method:** `GET`

---

## Implementation Notes
- **CORS:** All endpoints support Cross-Origin Resource Sharing (`*`).
- **Edge Runtime:** Powered by Vercel Edge Functions for sub-100ms response times.
- **Cache:** Stale-While-Revalidate pattern (60s maxage, 300s stale).
