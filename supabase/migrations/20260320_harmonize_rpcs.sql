-- ============================================================================
-- NASAKA IEBC: SCHEMA HARMONIZATION
-- 20260320 — Harmonizes 2024 and 2026 RPCs into a unified system
-- ============================================================================

-- ============================================================================
-- 1. HARMONIZE nearby_offices — delegates to find_offices_near_place
-- Preserves the original function signature so no caller breaks.
-- Body now uses the 2026 bounding-box-accelerated implementation.
-- ============================================================================

-- Drop ALL overloads of nearby_offices (handles type ambiguity)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS sig
    FROM pg_proc
    WHERE proname = 'nearby_offices'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.nearby_offices(
  user_lat DECIMAL,
  user_lng DECIMAL,
  radius_km DECIMAL DEFAULT 50
)
RETURNS TABLE (
  id INTEGER,
  county TEXT,
  constituency_name TEXT,
  office_location TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  distance_km DECIMAL,
  formatted_address TEXT,
  verified BOOLEAN
) AS $$
BEGIN
  -- Delegate to the 2026 bounding-box-accelerated implementation
  -- Preserves the original signature for backward compatibility
  RETURN QUERY
  SELECT
    f.id,
    f.county,
    f.constituency_name,
    f.office_location,
    f.latitude,
    f.longitude,
    f.distance_km,
    f.formatted_address,
    f.verified
  FROM public.find_offices_near_place(
    search_lat := user_lat,
    search_lng := user_lng,
    radius_km := radius_km,
    max_results := 50
  ) f;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.nearby_offices IS
  'Legacy wrapper — delegates to find_offices_near_place for bounding-box acceleration. Original 2024 callers unaffected.';

-- ============================================================================
-- 2. UNIFIED BILLING: charge_usage
-- Single entry point for all usage tracking.
-- Checks the user's tier to decide between request counting vs credit deduction.
-- Prevents double-taxing.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.charge_usage(
  p_key_id UUID,
  p_endpoint_weight INTEGER DEFAULT 1
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  limit_type TEXT,
  reason TEXT
) AS $$
DECLARE
  v_tier TEXT;
  v_plan_status TEXT;
  v_is_locked BOOLEAN;
  v_credits INTEGER;
  v_monthly_count INTEGER;
  v_monthly_limit INTEGER;
  v_current_period_end TIMESTAMPTZ;
  v_monthly_reset_date DATE;
BEGIN
  -- Fetch key state in a single query
  SELECT
    ak.tier,
    ak.plan_status,
    ak.is_locked,
    ak.credits_balance,
    ak.monthly_request_count,
    ak.current_period_end,
    ak.monthly_reset_date
  INTO
    v_tier, v_plan_status, v_is_locked,
    v_credits, v_monthly_count,
    v_current_period_end, v_monthly_reset_date
  FROM public.api_keys ak
  WHERE ak.id = p_key_id
  FOR UPDATE; -- Lock the row for atomic update

  -- Blocked checks
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'unknown'::TEXT, 'Key not found'::TEXT;
    RETURN;
  END IF;

  IF v_is_locked THEN
    RETURN QUERY SELECT false, 0, 'locked'::TEXT, 'Key is locked'::TEXT;
    RETURN;
  END IF;

  IF v_plan_status NOT IN ('active', 'non_renewing') THEN
    RETURN QUERY SELECT false, 0, 'inactive'::TEXT,
      ('Plan status: ' || v_plan_status)::TEXT;
    RETURN;
  END IF;

  -- Reset monthly counter if past reset date
  IF v_monthly_reset_date IS NOT NULL AND CURRENT_DATE > v_monthly_reset_date THEN
    UPDATE public.api_keys SET
      monthly_request_count = 0,
      monthly_reset_date = v_monthly_reset_date + INTERVAL '1 month'
    WHERE id = p_key_id;
    v_monthly_count := 0;
  END IF;

  -- Get the monthly limit for this tier
  v_monthly_limit := public.get_tier_monthly_limit(v_tier);

  -- Route based on billing model
  IF v_tier IN ('enterprise', 'serikali') OR v_credits > 0 THEN
    -- Credit-based billing
    IF v_credits < p_endpoint_weight THEN
      RETURN QUERY SELECT false, v_credits, 'credits'::TEXT,
        'Insufficient credits'::TEXT;
      RETURN;
    END IF;

    UPDATE public.api_keys SET
      credits_balance = credits_balance - p_endpoint_weight,
      requests_today = requests_today + 1,
      last_used_at = NOW()
    WHERE id = p_key_id;

    RETURN QUERY SELECT true, (v_credits - p_endpoint_weight), 'credits'::TEXT,
      'OK'::TEXT;
  ELSE
    -- Monthly-limit billing (free, mwananchi, taifa, etc.)
    IF v_monthly_count >= v_monthly_limit THEN
      RETURN QUERY SELECT false, (v_monthly_limit - v_monthly_count), 'requests'::TEXT,
        'Monthly limit reached'::TEXT;
      RETURN;
    END IF;

    UPDATE public.api_keys SET
      monthly_request_count = monthly_request_count + p_endpoint_weight,
      requests_today = requests_today + 1,
      last_used_at = NOW()
    WHERE id = p_key_id;

    RETURN QUERY SELECT true, (v_monthly_limit - v_monthly_count - p_endpoint_weight),
      'requests'::TEXT, 'OK'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.charge_usage IS
  'Unified billing RPC — routes between credit deduction and monthly request counting based on tier. Prevents double-taxing.';
