-- ============================================================================
-- NASAKA IEBC: CEKA AUTH INTEGRATION & FINAL SCHEMA PATCHES
-- Migration 20260317 — Adds ceka_user_id for OAuth linking;
-- adds UNIQUE index to prevent multiple keys per CEKA account.
-- ============================================================================

-- 1. ADD ceka_user_id COLUMN TO api_keys
ALTER TABLE public.api_keys 
ADD COLUMN IF NOT EXISTS ceka_user_id TEXT;

-- 2. ADD UNIQUE INDEX (Only for active keys to allow rotation if needed)
-- This ensures one CEKA user only has one active API key at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_ceka_user_unique 
ON public.api_keys (ceka_user_id) 
WHERE ceka_user_id IS NOT NULL AND is_active = true;

-- 3. ENSURE nasaka_profiles HAS THE NECESSARY COLUMNS FOR CEKA LINKING
ALTER TABLE public.nasaka_profiles
ADD COLUMN IF NOT EXISTS ceka_id TEXT,
ADD COLUMN IF NOT EXISTS ceka_data JSONB;

-- 4. GRANT PERMISSIONS
GRANT ALL ON TABLE public.api_keys TO service_role;
GRANT ALL ON TABLE public.nasaka_profiles TO service_role;
