-- ============================================================================
-- NASAKA IEBC: API KEY SCHEMA PATCH
-- Adds user_id and key_prefix which were missing from the initial migration
-- but are required by the Dashboard and Auth logic.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add user_id and key_prefix
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS key_prefix TEXT;

-- 2. Update RLS to allow users to see their own keys
DROP POLICY IF EXISTS "Users can see their own keys" ON public.api_keys;
CREATE POLICY "Users can see their own keys"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Create a helper function to generate a test key
-- This calculates the SHA-256 hash in SQL so you can test immediately.
-- Usage: SELECT create_test_api_key('my_user_uuid', 'nasaka_live_test_123', 'mwananchi');
CREATE OR REPLACE FUNCTION public.create_test_api_key(
    p_user_id UUID,
    p_raw_key TEXT,
    p_tier TEXT
) RETURNS UUID AS $$
DECLARE
    v_key_id UUID;
    v_hash TEXT;
BEGIN
    -- Standard SHA-256 to hex
    v_hash := encode(digest(p_raw_key, 'sha256'), 'hex');

    INSERT INTO public.api_keys (
        user_id,
        key_hash,
        key_prefix,
        owner_name,
        owner_email,
        tier,
        plan_status,
        current_period_end
    ) VALUES (
        p_user_id,
        v_hash,
        left(p_raw_key, 12), -- first 12 chars
        'Test User',
        'test@example.com',
        p_tier,
        'active',
        now() + interval '30 days'
    ) RETURNING id INTO v_key_id;

    RETURN v_key_id;
END;
$$ LANGUAGE plpgsql;
