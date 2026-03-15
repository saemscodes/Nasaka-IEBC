# Nasaka IEBC B2B Public API Master Specification

This document serves as the single source of truth for the Nasaka IEBC Public API (v1). All endpoints are deployed as Vercel Edge Functions and are designed for high performance and scalability.

## Base URL
`https://nasakaiebc.civiceducationkenya.com/api/v1`

## Authentication
Most endpoints are public but rate-limited (Jamii tier). For higher quotas and premium features (Mwananchi, Taifa, Serikali), inclusion of an `X-API-Key` is required.

- **Header:** `X-API-Key: nasaka_live_...`
- **Quota Management:** Headers `X-Quota-Limit`, `X-Quota-Remaining`, and `X-Quota-Reset` are returned with every authenticated request.

---

## I. Data Endpoints

### 1. System Stats
Returns high-level aggregation of the IEBC office dataset.
- **Endpoint:** `/stats`
- **Method:** `GET`
- **Access:** Public
- **Response:**
```json
{
  "data": {
    "total_stations": 290,
    "verified_count": 195,
    "coordinate_coverage": 290,
    "counties_covered": 47,
    "snapshot_timestamp": "2026-03-15T..."
  }
}
```

### 2. County Directory
Lists all 47 counties with registration metadata.
- **Endpoint:** `/counties`
- **Method:** `GET`
- **Access:** Public

### 3. Office Registry
Queryable list of all 290 constituency offices.
- **Endpoint:** `/offices`
- **Method:** `GET`
- **Params:** `county`, `constituency`, `verified`, `limit` (max 200), `offset`.

### 4. Polling Station Locator
Find the nearest verified offices by coordinates or administrative area.
- **Endpoint:** `/locate`
- **Method:** `GET`
- **Params:** `lat`, `lng`, `radius` (km), `constituency`, `county`.

### 5. Constituency Boundary Lookup (PREMIUM)
Reverse lookup to find administrative and political context for a point.
- **Endpoint:** `/boundary`
- **Method:** `GET`
- **Access:** Mwananchi+ Tier
- **Weight:** 5 API Credits per request.

### 6. Coordinate Dataset (PREMIUM)
Bulk export for developers and GIS professionals.
- **Endpoint:** `/coordinates`
- **Method:** `GET`
- **Access:** Mwananchi+ Tier
- **Formats:** JSON, `?format=geojson`, `?format=csv`.

---

## II. Billing & Monetization

### 7. Pricing Matrix
Dynamically fetch all tiers, prices (KES/USD), and plan codes.
- **Endpoint:** `/billing/pricing`
- **Method:** `GET`
- **Note:** Used by frontend to render [Pricing Page](https://nasakaiebc.civiceducationkenya.com/pricing).

### 8. Payment Initialization
Initialize a Paystack checkout for subscriptions, credit packs, or data licenses.
- **Endpoint:** `/billing/initialize`
- **Method:** `POST` (Auth Required)
- **Body:** `{ "product_key": "mwananchi_monthly", "email": "user@email.com" }`

### 9. Enterprise Enquiry
Submit requests for custom quotas, SLA contracts, or SFTP data dumps.
- **Endpoint:** `/enterprise/enquire`
- **Method:** `POST`
- **Rate Limit:** 3 requests per IP per hour.

---

## III. Implementation Details

- **CORS:** Supported via `Access-Control-Allow-Origin: *`.
- **Latency:** Sub-100ms globally via Vercel Edge.
- **Webhooks:** Paystack events are handled at `/api/v1/billing/webhook`.
- **Cron:** Renewal reminders and grace periods are checked daily at `/api/v1/billing/cron/renewal-check`.

---

## Error Codes
- `401 Unauthorized`: API key missing or invalid.
- `402 Payment Required`: Quota exhausted or plan expired.
- `403 Forbidden`: Endpoint restricted for current tier.
- `429 Too Many Requests`: Burst rate limit exceeded.
