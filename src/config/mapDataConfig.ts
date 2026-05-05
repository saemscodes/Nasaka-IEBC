/**
 * src/config/mapDataConfig.ts
 * ✊🏽🇰🇪 Dual-Source Map Data Configuration
 *
 * Provides a switch mechanism between Supabase Storage (legacy) and
 * Backblaze B2 (egress-free) for all static GeoJSON / map data files.
 *
 * B2 bucket is PRIVATE — uses S3-compatible pre-signed URLs.
 * Supabase Storage remains the fallback at all times.
 *
 * Switch modes:
 *   'b2'       — B2 primary, Supabase fallback
 *   'supabase' — Supabase primary, B2 fallback
 *   'auto'     — Try B2 first; on failure, auto-switch to Supabase for the session
 */

// ✊🏽🇰🇪 CDN Proxy Base (Cloudflare Worker Domain)
const CDN_BASE_URL = import.meta.env.VITE_CDN_BASE_URL || 'https://static.civiceducationkenya.com';
const B2_BUCKET_NAME = 'nasaka-map-data'; // Fixed for the project

// ─── Supabase Storage Base (legacy, always available) ──────────────────────────
const SUPABASE_STORAGE_BASE = 'https://bfatlkobozblunojtltp.supabase.co/storage/v1/object/public/map-data';

// ─── Signed Supabase URLs (for files that use signed tokens) ───────────────────
const SUPABASE_SIGNED_COUNTIES_VOTERS = 'https://bfatlkobozblunojtltp.supabase.co/storage/v1/object/sign/map-data/FULL%20CORRECTED%20-%20Kenya%20Counties%20Voters%27%20Data.geojson?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kN2NhMTc4OC1jOGY0LTQzNTYtODRiNy1lMzA0ODJiMjcyMzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJtYXAtZGF0YS9GVUxMIENPUlJFQ1RFRCAtIEtlbnlhIENvdW50aWVzIFZvdGVycycgRGF0YS5nZW9qc29uIiwiaWF0IjoxNzU5NDc0Njg5LCJleHAiOjE3NjcyNTA2ODl9.Ibva3F5rotSZuviun2b-psMKwqAP9l1-rjg7OPri2bM';

// ─── File Manifest ─────────────────────────────────────────────────────────────
// All static map data files. Key = logical ID, value = filename in both buckets.
export const MAP_DATA_FILES = {
  IEBC_OFFICES: 'iebc_offices.geojson',
  IEBC_OFFICES_ROWS: 'iebc_offices_rows.geojson',
  COUNTIES_VOTERS: 'FULL%20CORRECTED%20-%20Kenya%20Counties%20Voters%27%20Data.geojson',
  HEALTHCARE_FACILITIES: 'healthcare_facilities.geojson',
  CONSTITUENCIES_CENTROIDS: 'constituencies_with_centroids.geojson',
  WARDS_CENTROIDS: 'kenya_wards_centroids.json',
  IEBC_WARDS: 'kenya_wards.geojson',
} as const;

export type MapDataFileKey = keyof typeof MAP_DATA_FILES;
export type StorageProvider = 'supabase' | 'b2' | 'auto';

let _activeProvider: StorageProvider = 'auto';
let _sessionFallbackTriggered = false;
const _failureLog: Array<{ provider: string; file: string; error: string; timestamp: number }> = [];

// ─── Manual Override ───────────────────────────────────────────────────────────

/**
 * Get the current active storage provider.
 */
export function getActiveProvider(): StorageProvider {
  return _activeProvider;
}

/**
 * Manually set the storage provider.
 * 'auto' = try B2 first, fallback to Supabase on failure.
 * 'b2' = B2 only (no fallback).
 * 'supabase' = Supabase only (no B2 attempts).
 */
export function setActiveProvider(provider: StorageProvider): void {
  _activeProvider = provider;
  _sessionFallbackTriggered = false;
  console.log(`[mapDataConfig] Storage provider set to: ${provider}`);
}

/**
 * Get the failure log for diagnostics.
 */
export function getFailureLog() {
  return [..._failureLog];
}

/**
 * Reset the session fallback state (re-enables B2 attempts after a failure).
 */
export function resetFallback(): void {
  _sessionFallbackTriggered = false;
  console.log('[mapDataConfig] Fallback state reset — B2 will be attempted again');
}

// B2 Auth is now handled server-side by the Cloudflare Worker Proxy.
// No client-side authorizeB2 function is needed.

// ─── URL Builders ──────────────────────────────────────────────────────────────

/**
 * Build a Supabase Storage public URL for a given file key.
 */
function getSupabaseUrl(fileKey: MapDataFileKey): string {
  // Counties Voters uses a signed URL (different path)
  if (fileKey === 'COUNTIES_VOTERS') {
    return SUPABASE_SIGNED_COUNTIES_VOTERS;
  }
  return `${SUPABASE_STORAGE_BASE}/${MAP_DATA_FILES[fileKey]}`;
}

/**
 * Fetch a file from B2 using the Cloudflare Smart Proxy.
 * The Proxy handles authentication and CORS headers.
 */
async function fetchFromB2(fileKey: MapDataFileKey, signal?: AbortSignal): Promise<Response> {
  const fileName = MAP_DATA_FILES[fileKey];
  // Decode the fileName for the proxy (it will be re-encoded if needed by fetch)
  const decodedFileName = decodeURIComponent(fileName);
  
  // Format: {cdn_base}/file/map-data/{fileName}
  const url = `${CDN_BASE_URL}/file/map-data/${decodedFileName}`;

  const response = await fetch(url, {
    method: 'GET',
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[CDN DIAGNOSTIC] ${response.status} error for ${decodedFileName}:`, errorText);
    throw new Error(`Proxy/B2 download failed: ${response.status} - ${errorText.substring(0, 100)}`);
  }

  return response;
}

// ─── Core Fetch With Switch ────────────────────────────────────────────────────

/**
 * Fetch a map data file with automatic provider switching.
 *
 * In 'auto' mode:
 *   1. Try B2 first (with 8s timeout)
 *   2. On failure, fall back to Supabase
 *   3. Log the failure for diagnostics
 *   4. If B2 fails, mark session as "fallback triggered" to skip B2 for remaining requests
 *
 * In 'b2' mode: B2 only, no fallback.
 * In 'supabase' mode: Supabase only, no B2.
 *
 * Returns the parsed JSON data.
 */
export async function fetchMapData<T = any>(fileKey: MapDataFileKey): Promise<T> {
  const provider = _activeProvider;

  // ── Supabase-Only Mode ─────────────────────────────────────────────────────
  if (provider === 'supabase') {
    return fetchFromSupabase<T>(fileKey);
  }

  // ── B2-Only Mode ───────────────────────────────────────────────────────────
  if (provider === 'b2') {
    return fetchFromB2ThenParse<T>(fileKey);
  }

  // ── Auto Mode ──────────────────────────────────────────────────────────────
  // Skip B2 if it already failed this session
  if (_sessionFallbackTriggered) {
    return fetchFromSupabase<T>(fileKey);
  }

  // Try B2 with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const result = await fetchFromB2ThenParse<T>(fileKey, controller.signal);
    clearTimeout(timeout);
    return result;
  } catch (err: any) {
    clearTimeout(timeout);

    const errorMsg = err?.name === 'AbortError' ? 'Timeout (8s)' : (err?.message || 'Unknown error');

    _failureLog.push({
      provider: 'b2',
      file: fileKey,
      error: errorMsg,
      timestamp: Date.now(),
    });

    console.warn(`[mapDataConfig] B2 failed for ${fileKey}: ${errorMsg} — falling back to Supabase`);
    _sessionFallbackTriggered = true;

    return fetchFromSupabase<T>(fileKey);
  }
}

/**
 * Fetch from B2 and parse JSON.
 */
async function fetchFromB2ThenParse<T>(fileKey: MapDataFileKey, signal?: AbortSignal): Promise<T> {
  const response = await fetchFromB2(fileKey, signal);
  return response.json() as Promise<T>;
}

/**
 * Fetch from Supabase Storage and parse JSON.
 */
async function fetchFromSupabase<T>(fileKey: MapDataFileKey): Promise<T> {
  const url = getSupabaseUrl(fileKey);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json,application/geo+json,text/plain,*/*',
    },
    mode: 'cors',
  });

  if (!response.ok) {
    throw new Error(`Supabase fetch failed for ${fileKey}: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// ─── Direct URL Getter (for components that need a URL, not a fetch) ───────────

/**
 * Get the URL for a file from the currently active provider.
 * For B2 (private), this returns the Supabase URL since B2 requires auth headers.
 * B2 files must be fetched via fetchMapData() instead of direct URL access.
 *
 * For Supabase, returns the public/signed URL directly.
 */
export function getMapDataUrl(fileKey: MapDataFileKey): string {
  // B2 is private — cannot construct a publicly-accessible URL.
  // Always return the Supabase URL for direct URL consumers.
  // Components that want B2 must use fetchMapData() instead.
  return getSupabaseUrl(fileKey);
}

/**
 * Fetch a map data file as raw text (not parsed JSON).
 * Useful for components that need the raw response text.
 */
export async function fetchMapDataRaw(fileKey: MapDataFileKey): Promise<string> {
  const provider = _activeProvider;

  if (provider === 'supabase' || _sessionFallbackTriggered) {
    const url = getSupabaseUrl(fileKey);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Supabase fetch failed: ${response.status}`);
    return response.text();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetchFromB2(fileKey, controller.signal);
    clearTimeout(timeout);
    return response.text();
  } catch (err: any) {
    clearTimeout(timeout);
    _sessionFallbackTriggered = true;

    const url = getSupabaseUrl(fileKey);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Supabase fallback fetch failed: ${response.status}`);
    return response.text();
  }
}

// ─── Diagnostics ───────────────────────────────────────────────────────────────

/**
 * Get the full status of the map data provider system.
 */
export function getProviderStatus() {
  return {
    activeProvider: _activeProvider,
    sessionFallbackTriggered: _sessionFallbackTriggered,
    cdnBaseUrl: CDN_BASE_URL,
    failureCount: _failureLog.length,
    recentFailures: _failureLog.slice(-5),
  };
}
