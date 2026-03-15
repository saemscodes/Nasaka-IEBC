-- ============================================================================
-- NASAKA IEBC: BILLING & MONETIZATION INFRASTRUCTURE
-- Migration 20260316 — Extends api_keys with Paystack billing columns;
-- creates usage_log, paystack_events, payment_history, enterprise_leads,
-- license_applications, and discount_applications tables.
-- ============================================================================

-- ==========================================================================
-- 1. EXTEND api_keys WITH BILLING COLUMNS
-- ==========================================================================
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_plan_code TEXT,
  ADD COLUMN IF NOT EXISTS tier_currency TEXT DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly','annual','one_time','credit_pack','data_license')),
  ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'active'
    CHECK (plan_status IN ('active','non_renewing','past_due','cancelled','paused')),
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS monthly_request_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_reset_date TIMESTAMPTZ
    DEFAULT date_trunc('month', now()) + interval '1 month',
  ADD COLUMN IF NOT EXISTS credits_balance INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mpesa_renewal_method TEXT DEFAULT 'manual_prompt'
    CHECK (mpesa_renewal_method IN ('manual_prompt','card_fallback')),
  ADD COLUMN IF NOT EXISTS renewal_reminder_sent_at TIMESTAMPTZ;

-- Update the tier CHECK constraint to use Kenyan tier names.
-- Drop old constraint if it exists, then add new one.
DO $$
BEGIN
  ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_tier_check;
  ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_tier_check
    CHECK (tier IN ('free','standard','enterprise','jamii','mwananchi','taifa','serikali'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Migrate existing 'free' tier keys to 'jamii'
UPDATE public.api_keys SET tier = 'jamii' WHERE tier = 'free';
UPDATE public.api_keys SET tier = 'mwananchi' WHERE tier = 'standard';
UPDATE public.api_keys SET tier = 'taifa' WHERE tier = 'enterprise';

-- ==========================================================================
-- 2. USAGE LOG TABLE
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.nasaka_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  response_code INTEGER NOT NULL,
  ip_hash TEXT,
  request_weight INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nasaka_usage_log_key_created
  ON public.nasaka_usage_log (api_key_id, created_at);

-- ==========================================================================
-- 3. PAYSTACK EVENTS — IDEMPOTENCY TABLE
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.nasaka_paystack_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paystack_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  api_key_id UUID REFERENCES public.api_keys(id),
  raw_payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================================
-- 4. PAYMENT HISTORY — UNIFIED CARD/M-PESA LOG
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.nasaka_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id),
  paystack_reference TEXT UNIQUE NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('card','mobile_money','bank_transfer')),
  amount_kobo INTEGER NOT NULL,
  currency TEXT DEFAULT 'KES',
  tier_purchased TEXT NOT NULL,
  billing_interval TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','failed','reversed')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================================
-- 5. ENTERPRISE LEADS — SERIKALI SALES PIPELINE
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.nasaka_enterprise_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  organisation_type TEXT CHECK (organisation_type IN (
    'county_government','ngo','development_agency',
    'media_house','research_institution','election_observer','other'
  )),
  use_case TEXT NOT NULL,
  estimated_monthly_requests TEXT,
  preferred_currency TEXT DEFAULT 'KES',
  status TEXT DEFAULT 'new'
    CHECK (status IN ('new','contacted','proposal_sent','contracted','closed_lost')),
  assigned_to TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================================
-- 6. LICENSE APPLICATIONS — DATA LICENSE REQUESTS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.nasaka_license_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id),
  applicant_name TEXT NOT NULL,
  institution TEXT NOT NULL,
  use_case_type TEXT CHECK (use_case_type IN ('academic','commercial','nonprofit')),
  use_case_description TEXT NOT NULL,
  license_type TEXT CHECK (license_type IN ('academic','commercial')),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  paystack_reference TEXT,
  approved_at TIMESTAMPTZ,
  download_url TEXT,
  download_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================================
-- 7. DISCOUNT APPLICATIONS — NONPROFIT/ACADEMIC DISCOUNT REQUESTS
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.nasaka_discount_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id),
  applicant_email TEXT NOT NULL,
  organisation TEXT NOT NULL,
  discount_type TEXT CHECK (discount_type IN ('nonprofit','academic')),
  proof_document_url TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================================================
-- 8. RLS POLICIES
-- ==========================================================================
ALTER TABLE public.nasaka_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nasaka_paystack_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nasaka_payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nasaka_enterprise_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nasaka_license_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nasaka_discount_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on nasaka_usage_log"
  ON public.nasaka_usage_log FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access on nasaka_paystack_events"
  ON public.nasaka_paystack_events FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access on nasaka_payment_history"
  ON public.nasaka_payment_history FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access on nasaka_enterprise_leads"
  ON public.nasaka_enterprise_leads FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access on nasaka_license_applications"
  ON public.nasaka_license_applications FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access on nasaka_discount_applications"
  ON public.nasaka_discount_applications FOR ALL TO service_role USING (true);

-- ==========================================================================
-- 9. UPDATED validate_api_key RPC — RETURNS BILLING CONTEXT
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash TEXT)
RETURNS TABLE (
    id UUID,
    tier TEXT,
    requests_today INTEGER,
    is_active BOOLEAN,
    monthly_request_count INTEGER,
    credits_balance INTEGER,
    is_locked BOOLEAN,
    plan_status TEXT,
    current_period_end TIMESTAMPTZ,
    monthly_reset_date TIMESTAMPTZ
) AS $$
BEGIN
    -- Reset monthly counter if past reset date
    UPDATE public.api_keys
    SET
        monthly_request_count = 0,
        monthly_reset_date = date_trunc('month', now()) + interval '1 month'
    WHERE key_hash = p_key_hash
      AND is_active = true
      AND monthly_reset_date <= now();

    -- Increment counters and return full billing context
    RETURN QUERY
    UPDATE public.api_keys
    SET
        last_used_at = now(),
        requests_today = api_keys.requests_today + 1,
        requests_this_month = api_keys.requests_this_month + 1,
        monthly_request_count = api_keys.monthly_request_count + 1
    WHERE key_hash = p_key_hash AND is_active = true
    RETURNING
        api_keys.id,
        api_keys.tier,
        api_keys.requests_today,
        api_keys.is_active,
        api_keys.monthly_request_count,
        api_keys.credits_balance,
        api_keys.is_locked,
        api_keys.plan_status,
        api_keys.current_period_end,
        api_keys.monthly_reset_date;
END;
$$ LANGUAGE plpgsql;

-- ==========================================================================
-- 10. MONTHLY QUOTA LIMIT FUNCTION
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.get_tier_monthly_limit(p_tier TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE p_tier
        WHEN 'jamii' THEN 5000
        WHEN 'mwananchi' THEN 100000
        WHEN 'taifa' THEN 500000
        WHEN 'serikali' THEN 10000000
        WHEN 'free' THEN 5000
        WHEN 'standard' THEN 100000
        WHEN 'enterprise' THEN 500000
        ELSE 5000
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
