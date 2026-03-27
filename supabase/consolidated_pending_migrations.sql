-- ============================================================================
-- NASAKA IEBC: CONSOLIDATED PENDING MIGRATIONS (PURGED)
-- Generated: 2026-03-27
-- Against: context/BACKUP/backup2.sql (bare Supabase instance)
-- Scope: ONLY Nasaka IEBC 2026 Jan–March migrations
-- Excluded: All pre-2026 legacy, diaspora tables/RPCs/seed data, petitions
-- ============================================================================
-- PREREQUISITES: The following tables MUST already exist before running:
--   - public.iebc_offices (core office data, typically CSV-imported)
--   - public.iebc_office_contributions (community contributions)
--   - public.core_team (admin team, for RLS policies)
--   - public.wards (ward hierarchy data)
--   - public.counties (county reference data)
--   - public.constituencies (constituency reference data)
-- Extensions: postgis, pgcrypto, pg_trgm, cube, earthdistance, fuzzystrmatch
-- ============================================================================

BEGIN;

-- ============================================================================
-- MIGRATION 1: Admin HITL Tables (20260306)
-- Admin task orchestration for geocode verification
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    params JSONB DEFAULT '{}',
    proposed_changes JSONB DEFAULT '[]',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.admin_task_logs (
    id BIGSERIAL PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.admin_tasks(id) ON DELETE CASCADE,
    level TEXT NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_task_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can do everything on admin_tasks" ON public.admin_tasks;
CREATE POLICY "Admins can do everything on admin_tasks"
    ON public.admin_tasks FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.core_team WHERE core_team.user_id = auth.uid() AND core_team.is_admin = true));

DROP POLICY IF EXISTS "Admins can do everything on admin_task_logs" ON public.admin_task_logs;
CREATE POLICY "Admins can do everything on admin_task_logs"
    ON public.admin_task_logs FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.core_team WHERE core_team.user_id = auth.uid() AND core_team.is_admin = true));

ALTER TABLE public.admin_task_logs REPLICA IDENTITY FULL;


-- ============================================================================
-- MIGRATION 2: API Integration — IEBC Office Columns (20260312)
-- Elevation, isochrone, landmark columns + geocoding service log
-- ============================================================================

ALTER TABLE public.iebc_offices
  ADD COLUMN IF NOT EXISTS elevation_meters NUMERIC,
  ADD COLUMN IF NOT EXISTS isochrone_15min JSONB,
  ADD COLUMN IF NOT EXISTS isochrone_30min JSONB,
  ADD COLUMN IF NOT EXISTS isochrone_45min JSONB,
  ADD COLUMN IF NOT EXISTS landmark_normalized TEXT,
  ADD COLUMN IF NOT EXISTS landmark_source TEXT,
  ADD COLUMN IF NOT EXISTS walking_effort TEXT CHECK (walking_effort IN ('low', 'moderate', 'high', 'extreme'));

COMMENT ON COLUMN public.iebc_offices.elevation_meters IS 'Altitude in meters above sea level from Open Topo Data';
COMMENT ON COLUMN public.iebc_offices.walking_effort IS 'Computed from elevation: low (<200m), moderate (200-800m), high (800-1500m), extreme (>1500m)';

CREATE INDEX IF NOT EXISTS idx_iebc_offices_walking_effort ON public.iebc_offices(walking_effort);
CREATE INDEX IF NOT EXISTS idx_iebc_offices_elevation ON public.iebc_offices(elevation_meters);

CREATE TABLE IF NOT EXISTS public.geocoding_service_log (
  id BIGSERIAL PRIMARY KEY,
  service_name TEXT NOT NULL CHECK (service_name IN ('nominatim', 'opencage', 'openrouteservice', 'opentopo', 'ipapi')),
  request_type TEXT NOT NULL CHECK (request_type IN ('forward_geocode', 'reverse_geocode', 'isochrone', 'elevation', 'ip_geolocation', 'routing')),
  query_text TEXT,
  office_id INTEGER REFERENCES public.iebc_offices(id) ON DELETE SET NULL,
  response_status INTEGER,
  response_time_ms INTEGER,
  credits_used INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geocoding_log_service ON public.geocoding_service_log(service_name);
CREATE INDEX IF NOT EXISTS idx_geocoding_log_created ON public.geocoding_service_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_geocoding_log_office ON public.geocoding_service_log(office_id);

ALTER TABLE public.geocoding_service_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view geocoding logs" ON public.geocoding_service_log;
CREATE POLICY "Anyone can view geocoding logs"
  ON public.geocoding_service_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert geocoding logs" ON public.geocoding_service_log;
CREATE POLICY "Anyone can insert geocoding logs"
  ON public.geocoding_service_log FOR INSERT WITH CHECK (true);

-- RPC: get_offices_by_walking_effort
DROP FUNCTION IF EXISTS public.get_offices_by_walking_effort(TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.get_offices_by_walking_effort(
  effort_level TEXT, limit_count INTEGER DEFAULT 50
) RETURNS TABLE (
  id INTEGER, county TEXT, constituency_name TEXT, office_location TEXT,
  latitude DECIMAL, longitude DECIMAL, elevation_meters NUMERIC,
  walking_effort TEXT, landmark_normalized TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.county, o.constituency_name, o.office_location,
    o.latitude, o.longitude, o.elevation_meters, o.walking_effort, o.landmark_normalized
  FROM public.iebc_offices o
  WHERE o.verified = true AND o.walking_effort = effort_level
    AND o.latitude IS NOT NULL AND o.longitude IS NOT NULL
  ORDER BY o.elevation_meters DESC NULLS LAST LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- RPC: get_office_isochrone
DROP FUNCTION IF EXISTS public.get_office_isochrone(INTEGER);
CREATE OR REPLACE FUNCTION public.get_office_isochrone(office_id_param INTEGER)
RETURNS TABLE (
  id INTEGER, county TEXT, constituency_name TEXT, latitude DECIMAL, longitude DECIMAL,
  elevation_meters NUMERIC, walking_effort TEXT, landmark_normalized TEXT,
  isochrone_15min JSONB, isochrone_30min JSONB, isochrone_45min JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.county, o.constituency_name, o.latitude, o.longitude,
    o.elevation_meters, o.walking_effort, o.landmark_normalized,
    o.isochrone_15min, o.isochrone_30min, o.isochrone_45min
  FROM public.iebc_offices o WHERE o.id = office_id_param AND o.verified = true;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- MIGRATION 3: Geocode Consensus (20260312)
-- Audit trail + HITL queue for coordinate verification
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.geocode_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    office_id INTEGER NOT NULL REFERENCES public.iebc_offices(id) ON DELETE CASCADE,
    constituency TEXT NOT NULL,
    county TEXT NOT NULL,
    issue_type TEXT NOT NULL CHECK (issue_type IN ('DISPLACED', 'NULL_COORDS', 'CLUSTERING', 'DISPLACED_REVERIFY', 'NULL_COORDS_REVERIFY', 'CLUSTERING_REVERIFY')),
    old_latitude DOUBLE PRECISION,
    old_longitude DOUBLE PRECISION,
    new_latitude DOUBLE PRECISION,
    new_longitude DOUBLE PRECISION,
    source_results JSONB DEFAULT '[]',
    consensus_confidence DOUBLE PRECISION,
    agreement_count INTEGER,
    spread_km DOUBLE PRECISION,
    sources_used TEXT[] DEFAULT '{}',
    resolution_method TEXT NOT NULL DEFAULT 'auto' CHECK (resolution_method IN ('auto', 'admin_manual', 'gold_standard', 'multi_source_consensus')),
    resolved_by TEXT DEFAULT 'system',
    applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_geocode_audit_office ON public.geocode_audit(office_id);
CREATE INDEX IF NOT EXISTS idx_geocode_audit_issue ON public.geocode_audit(issue_type);
CREATE INDEX IF NOT EXISTS idx_geocode_audit_applied ON public.geocode_audit(applied);
CREATE INDEX IF NOT EXISTS idx_geocode_audit_created ON public.geocode_audit(created_at DESC);

CREATE TABLE IF NOT EXISTS public.geocode_hitl_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    office_id INTEGER NOT NULL REFERENCES public.iebc_offices(id) ON DELETE CASCADE,
    audit_id UUID REFERENCES public.geocode_audit(id) ON DELETE SET NULL,
    issue_type TEXT NOT NULL,
    proposed_latitude DOUBLE PRECISION,
    proposed_longitude DOUBLE PRECISION,
    confidence DOUBLE PRECISION,
    agreement_count INTEGER,
    spread_km DOUBLE PRECISION,
    source_details JSONB DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed', 'auto_resolved')),
    resolved_by TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    final_latitude DOUBLE PRECISION,
    final_longitude DOUBLE PRECISION,
    dismiss_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hitl_queue_status ON public.geocode_hitl_queue(status);
CREATE INDEX IF NOT EXISTS idx_hitl_queue_office ON public.geocode_hitl_queue(office_id);
CREATE INDEX IF NOT EXISTS idx_hitl_queue_created ON public.geocode_hitl_queue(created_at DESC);

ALTER TABLE public.iebc_offices
    ADD COLUMN IF NOT EXISTS geocode_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS geocode_verified_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS multi_source_confidence DOUBLE PRECISION;

ALTER TABLE public.geocode_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocode_hitl_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can do everything on geocode_audit" ON public.geocode_audit;
CREATE POLICY "Admins can do everything on geocode_audit"
    ON public.geocode_audit FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.core_team WHERE core_team.user_id = auth.uid() AND core_team.is_admin = true));
DROP POLICY IF EXISTS "Admins can do everything on geocode_hitl_queue" ON public.geocode_hitl_queue;
CREATE POLICY "Admins can do everything on geocode_hitl_queue"
    ON public.geocode_hitl_queue FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.core_team WHERE core_team.user_id = auth.uid() AND core_team.is_admin = true));
DROP POLICY IF EXISTS "Service role full access on geocode_audit" ON public.geocode_audit;
CREATE POLICY "Service role full access on geocode_audit"
    ON public.geocode_audit FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "Service role full access on geocode_hitl_queue" ON public.geocode_hitl_queue;
CREATE POLICY "Service role full access on geocode_hitl_queue"
    ON public.geocode_hitl_queue FOR ALL TO service_role USING (true);

ALTER TABLE public.geocode_hitl_queue REPLICA IDENTITY FULL;


-- ============================================================================
-- MIGRATION 4: Public API Keys (20260315)
-- API key management + county stats RPC
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash TEXT NOT NULL UNIQUE,
    owner_name TEXT NOT NULL,
    owner_email TEXT NOT NULL,
    organization TEXT,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'standard', 'enterprise')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    requests_today INTEGER DEFAULT 0,
    requests_this_month INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.api_usage_log (
    id BIGSERIAL PRIMARY KEY,
    api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    response_status INTEGER,
    response_time_ms INTEGER,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on api_keys" ON public.api_keys;
CREATE POLICY "Service role full access on api_keys"
  ON public.api_keys FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "Service role full access on api_usage_log" ON public.api_usage_log;
CREATE POLICY "Service role full access on api_usage_log"
  ON public.api_usage_log FOR ALL TO service_role USING (true);

DROP FUNCTION IF EXISTS public.validate_api_key(TEXT);
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash TEXT)
RETURNS TABLE (id UUID, tier TEXT, requests_today INTEGER, is_active BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    UPDATE public.api_keys
    SET last_used_at = now(), requests_today = requests_today + 1,
        requests_this_month = requests_this_month + 1
    WHERE key_hash = p_key_hash AND is_active = true
    RETURNING api_keys.id, api_keys.tier, api_keys.requests_today, api_keys.is_active;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_county_stats()
RETURNS TABLE (county TEXT, office_count BIGINT, mapped_count BIGINT, verified_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT o.county, COUNT(o.id), COUNT(CASE WHEN o.latitude IS NOT NULL THEN 1 END),
           COUNT(CASE WHEN o.verified = true THEN 1 END)
    FROM public.iebc_offices o GROUP BY o.county ORDER BY o.county ASC;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_usage_key_id ON public.api_usage_log(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage_log(created_at DESC);


-- ============================================================================
-- MIGRATION 5: Billing Infrastructure (20260316)
-- Paystack billing columns, usage log, payment history, enterprise leads
-- ============================================================================

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

DO $$
BEGIN
  ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_tier_check;
  ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_tier_check
    CHECK (tier IN ('free','standard','enterprise','jamii','mwananchi','taifa','serikali'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

UPDATE public.api_keys SET tier = 'jamii' WHERE tier = 'free';
UPDATE public.api_keys SET tier = 'mwananchi' WHERE tier = 'standard';
UPDATE public.api_keys SET tier = 'taifa' WHERE tier = 'enterprise';

CREATE TABLE IF NOT EXISTS public.nasaka_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL, response_code INTEGER NOT NULL,
  ip_hash TEXT, request_weight INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nasaka_usage_log_key_created ON public.nasaka_usage_log (api_key_id, created_at);

CREATE TABLE IF NOT EXISTS public.nasaka_paystack_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paystack_event_id TEXT UNIQUE NOT NULL, event_type TEXT NOT NULL,
  api_key_id UUID REFERENCES public.api_keys(id),
  raw_payload JSONB NOT NULL, processed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nasaka_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id),
  paystack_reference TEXT UNIQUE NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('card','mobile_money','bank_transfer')),
  amount_kobo INTEGER NOT NULL, currency TEXT DEFAULT 'KES',
  tier_purchased TEXT NOT NULL, billing_interval TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','failed','reversed')),
  paid_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nasaka_enterprise_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_name TEXT NOT NULL, contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL, contact_phone TEXT,
  organisation_type TEXT CHECK (organisation_type IN (
    'county_government','ngo','development_agency','media_house','research_institution','election_observer','other'
  )),
  use_case TEXT NOT NULL, estimated_monthly_requests TEXT,
  preferred_currency TEXT DEFAULT 'KES',
  status TEXT DEFAULT 'new' CHECK (status IN ('new','contacted','proposal_sent','contracted','closed_lost')),
  assigned_to TEXT, notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nasaka_license_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id),
  applicant_name TEXT NOT NULL, institution TEXT NOT NULL,
  use_case_type TEXT CHECK (use_case_type IN ('academic','commercial','nonprofit')),
  use_case_description TEXT NOT NULL,
  license_type TEXT CHECK (license_type IN ('academic','commercial')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  paystack_reference TEXT, approved_at TIMESTAMPTZ,
  download_url TEXT, download_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nasaka_discount_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id),
  applicant_email TEXT NOT NULL, organisation TEXT NOT NULL,
  discount_type TEXT CHECK (discount_type IN ('nonprofit','academic')),
  proof_document_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.nasaka_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nasaka_paystack_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nasaka_payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nasaka_enterprise_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nasaka_license_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nasaka_discount_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on nasaka_usage_log" ON public.nasaka_usage_log;
CREATE POLICY "Service role full access on nasaka_usage_log" ON public.nasaka_usage_log FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "Service role full access on nasaka_paystack_events" ON public.nasaka_paystack_events;
CREATE POLICY "Service role full access on nasaka_paystack_events" ON public.nasaka_paystack_events FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "Service role full access on nasaka_payment_history" ON public.nasaka_payment_history;
CREATE POLICY "Service role full access on nasaka_payment_history" ON public.nasaka_payment_history FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "Service role full access on nasaka_enterprise_leads" ON public.nasaka_enterprise_leads;
CREATE POLICY "Service role full access on nasaka_enterprise_leads" ON public.nasaka_enterprise_leads FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "Service role full access on nasaka_license_applications" ON public.nasaka_license_applications;
CREATE POLICY "Service role full access on nasaka_license_applications" ON public.nasaka_license_applications FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS "Service role full access on nasaka_discount_applications" ON public.nasaka_discount_applications;
CREATE POLICY "Service role full access on nasaka_discount_applications" ON public.nasaka_discount_applications FOR ALL TO service_role USING (true);

-- Upgraded validate_api_key with billing context (DROP old signature first)
DROP FUNCTION IF EXISTS public.validate_api_key(TEXT);
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash TEXT)
RETURNS TABLE (
    id UUID, tier TEXT, requests_today INTEGER, is_active BOOLEAN,
    monthly_request_count INTEGER, credits_balance INTEGER, is_locked BOOLEAN,
    plan_status TEXT, current_period_end TIMESTAMPTZ, monthly_reset_date TIMESTAMPTZ
) AS $$
BEGIN
    UPDATE public.api_keys SET monthly_request_count = 0,
        monthly_reset_date = date_trunc('month', now()) + interval '1 month'
    WHERE key_hash = p_key_hash AND is_active = true AND monthly_reset_date <= now();

    RETURN QUERY
    UPDATE public.api_keys SET last_used_at = now(), requests_today = api_keys.requests_today + 1,
        requests_this_month = api_keys.requests_this_month + 1,
        monthly_request_count = api_keys.monthly_request_count + 1
    WHERE key_hash = p_key_hash AND is_active = true
    RETURNING api_keys.id, api_keys.tier, api_keys.requests_today, api_keys.is_active,
        api_keys.monthly_request_count, api_keys.credits_balance, api_keys.is_locked,
        api_keys.plan_status, api_keys.current_period_end, api_keys.monthly_reset_date;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_tier_monthly_limit(p_tier TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE p_tier
        WHEN 'jamii' THEN 5000 WHEN 'mwananchi' THEN 100000
        WHEN 'taifa' THEN 500000 WHEN 'serikali' THEN 10000000
        WHEN 'free' THEN 5000 WHEN 'standard' THEN 100000
        WHEN 'enterprise' THEN 500000 ELSE 5000
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================================================
-- MIGRATION 6: County Normalization (20260316)
-- Fixes 54-county bug → canonical 47
-- ============================================================================

UPDATE iebc_offices SET county = 'TANA RIVER' WHERE UPPER(TRIM(county)) IN ('TANARIVER', 'TANA-RIVER', 'TANA RIVER COUNTY');
UPDATE iebc_offices SET county = 'TAITA TAVETA' WHERE UPPER(TRIM(county)) IN ('TAITA-TAVETA', 'TAITA/TAVETA', 'TAITA / TAVETA', 'TAITA TAVETA COUNTY');
UPDATE iebc_offices SET county = 'THARAKA-NITHI' WHERE UPPER(TRIM(county)) IN ('THARAKA NITHI', 'THARAKA NITHI ', 'THARAKA  NITHI', 'THARAKA - NITHI', 'THARAKA / NITHI');
UPDATE iebc_offices SET county = 'MURANG''A' WHERE UPPER(TRIM(county)) IN ('MURANGA', 'MURANG A', 'MURANG''A ', 'MURANG''A COUNTY');
UPDATE iebc_offices SET county = 'WEST POKOT' WHERE UPPER(TRIM(county)) IN ('WESTPOKOT', 'WEST-POKOT', 'WEST POKOT COUNTY');
UPDATE iebc_offices SET county = 'TRANS-NZOIA' WHERE UPPER(TRIM(county)) IN ('TRANS NZOIA', 'TRANSNZOIA', 'TRANS NZOIA ', 'TRANS-NZOIA COUNTY');
UPDATE iebc_offices SET county = 'UASIN GISHU' WHERE UPPER(TRIM(county)) IN ('UASINGISHU', 'UASIN-GISHU', 'UASIN GISHU ', 'UASIN GISHU COUNTY');
UPDATE iebc_offices SET county = 'ELGEYO-MARAKWET' WHERE UPPER(TRIM(county)) IN ('ELGEYO MARAKWET', 'ELGEYO/MARAKWET', 'KEIYO-MARAKWET', 'KEIYO MARAKWET', 'ELEGEYO-MARAKWET', 'ELGEYO MARAKWET COUNTY', 'ELGEYO-MARAKWET COUNTY');
UPDATE iebc_offices SET county = 'HOMA BAY' WHERE UPPER(TRIM(county)) IN ('HOMABAY', 'HOMA-BAY', 'HOMA BAY COUNTY');
UPDATE iebc_offices SET county = 'NAIROBI' WHERE UPPER(TRIM(county)) IN ('NAIROBI CITY', 'NAIROBI COUNTY');
UPDATE iebc_offices SET county = UPPER(TRIM(county)) WHERE county != UPPER(TRIM(county));


-- ============================================================================
-- MIGRATION 7: Auth Support (20260316)
-- Nasaka profiles + auto-onboarding trigger
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.nasaka_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT, avatar_url TEXT,
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_nasaka_user_profile UNIQUE(user_id)
);

ALTER TABLE public.nasaka_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own nasaka profile" ON public.nasaka_profiles;
CREATE POLICY "Users can view their own nasaka profile"
    ON public.nasaka_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own nasaka profile" ON public.nasaka_profiles;
CREATE POLICY "Users can update their own nasaka profile"
    ON public.nasaka_profiles FOR UPDATE TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_nasaka_new_user()
RETURNS TRIGGER AS $$
DECLARE v_raw_key TEXT; v_hash TEXT; v_key_prefix TEXT;
BEGIN
    INSERT INTO public.nasaka_profiles (user_id, display_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', 'Developer'))
    ON CONFLICT (user_id) DO NOTHING;

    v_raw_key := 'nasaka_' || encode(gen_random_bytes(16), 'hex');
    v_hash := encode(digest(v_raw_key, 'sha256'), 'hex');
    v_key_prefix := left(v_raw_key, 12);

    INSERT INTO public.api_keys (user_id, key_hash, key_prefix, owner_name, owner_email, tier, plan_status, monthly_request_count, credits_balance)
    VALUES (NEW.id, v_hash, v_key_prefix, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Developer'), NEW.email, 'jamii', 'active', 0, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_nasaka_auth_user_created ON auth.users;
CREATE TRIGGER on_nasaka_auth_user_created
    AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_nasaka_new_user();

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_nasaka_profiles_updated_at ON public.nasaka_profiles;
CREATE TRIGGER set_nasaka_profiles_updated_at
    BEFORE UPDATE ON public.nasaka_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ============================================================================
-- MIGRATION 8: Schema Patch (20260316)
-- Adds user_id, key_prefix to api_keys + test key helper
-- ============================================================================

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS key_prefix TEXT;

DROP POLICY IF EXISTS "Users can see their own keys" ON public.api_keys;
CREATE POLICY "Users can see their own keys"
  ON public.api_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.create_test_api_key(p_user_id UUID, p_raw_key TEXT, p_tier TEXT)
RETURNS UUID AS $$
DECLARE v_key_id UUID; v_hash TEXT;
BEGIN
    v_hash := encode(digest(p_raw_key, 'sha256'), 'hex');
    INSERT INTO public.api_keys (user_id, key_hash, key_prefix, owner_name, owner_email, tier, plan_status, current_period_end)
    VALUES (p_user_id, v_hash, left(p_raw_key, 12), 'Test User', 'test@example.com', p_tier, 'active', now() + interval '30 days')
    RETURNING id INTO v_key_id;
    RETURN v_key_id;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- MIGRATION 9: CEKA Auth Integration (20260317)
-- ceka_user_id for OAuth linking
-- ============================================================================

ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS ceka_user_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_ceka_user_unique
  ON public.api_keys (ceka_user_id) WHERE ceka_user_id IS NOT NULL AND is_active = true;

ALTER TABLE public.nasaka_profiles
  ADD COLUMN IF NOT EXISTS ceka_id TEXT,
  ADD COLUMN IF NOT EXISTS ceka_data JSONB;

GRANT ALL ON TABLE public.api_keys TO service_role;
GRANT ALL ON TABLE public.nasaka_profiles TO service_role;


-- ============================================================================
-- MIGRATION 10: Credit Deduction RPC (20260320)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.deduct_credits(p_key_id UUID, p_amount INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.api_keys SET credits_balance = GREATEST(credits_balance - p_amount, 0)
    WHERE id = p_key_id AND is_active = true AND credits_balance > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- MIGRATION 11: Geolocation RPCs (20260320) — IEBC ONLY
-- Proximity search + text search with geographic bias
-- (Diaspora tables, seed data, and diaspora RPCs EXCLUDED)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_iebc_offices_lat_lng ON public.iebc_offices(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_iebc_offices_fts
  ON public.iebc_offices
  USING GIN(
    to_tsvector('english',
      COALESCE(county, '') || ' ' ||
      COALESCE(constituency_name, '') || ' ' ||
      COALESCE(constituency, '') || ' ' ||
      COALESCE(office_location, '') || ' ' ||
      COALESCE(landmark, '') || ' ' ||
      COALESCE(formatted_address, '')
    )
  );

CREATE OR REPLACE FUNCTION find_offices_near_place(
  search_lat FLOAT, search_lng FLOAT, radius_km FLOAT DEFAULT 15, max_results INT DEFAULT 20
) RETURNS TABLE (
  id INTEGER, county TEXT, constituency_name TEXT, constituency TEXT,
  office_location TEXT, latitude FLOAT, longitude FLOAT, verified BOOLEAN,
  formatted_address TEXT, landmark TEXT, clean_office_location TEXT, distance_km FLOAT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT o.* FROM public.iebc_offices o
    WHERE o.latitude IS NOT NULL AND o.longitude IS NOT NULL AND o.verified = true
      AND o.latitude BETWEEN search_lat - (radius_km / 111.0) AND search_lat + (radius_km / 111.0)
      AND o.longitude BETWEEN search_lng - (radius_km / (111.0 * cos(radians(search_lat))))
                           AND search_lng + (radius_km / (111.0 * cos(radians(search_lat))))
  ), with_distance AS (
    SELECT c.id, c.county, c.constituency_name, c.constituency, c.office_location,
      c.latitude, c.longitude, c.verified, c.formatted_address, c.landmark, c.clean_office_location,
      (6371 * acos(LEAST(1.0, GREATEST(-1.0,
        cos(radians(search_lat)) * cos(radians(c.latitude)) *
        cos(radians(c.longitude) - radians(search_lng)) +
        sin(radians(search_lat)) * sin(radians(c.latitude))
      ))))::FLOAT AS distance_km
    FROM candidates c
  )
  SELECT wd.* FROM with_distance wd WHERE wd.distance_km <= radius_km ORDER BY wd.distance_km ASC LIMIT max_results;
END;
$$;

CREATE OR REPLACE FUNCTION search_offices_by_text_and_location(
  search_query TEXT, search_lat FLOAT DEFAULT NULL, search_lng FLOAT DEFAULT NULL,
  radius_km FLOAT DEFAULT 50, max_results INT DEFAULT 10
) RETURNS TABLE (
  id INTEGER, county TEXT, constituency_name TEXT, constituency TEXT,
  office_location TEXT, latitude FLOAT, longitude FLOAT, verified BOOLEAN,
  formatted_address TEXT, landmark TEXT, clean_office_location TEXT,
  distance_km FLOAT, text_rank FLOAT, combined_score FLOAT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  WITH text_matches AS (
    SELECT o.id, o.county, o.constituency_name, o.constituency, o.office_location,
      o.latitude, o.longitude, o.verified, o.formatted_address, o.landmark, o.clean_office_location,
      ts_rank(to_tsvector('english',
        COALESCE(o.county, '') || ' ' || COALESCE(o.constituency_name, '') || ' ' ||
        COALESCE(o.constituency, '') || ' ' || COALESCE(o.office_location, '') || ' ' ||
        COALESCE(o.landmark, '') || ' ' || COALESCE(o.formatted_address, '')
      ), plainto_tsquery('english', search_query))::FLOAT AS text_rank
    FROM public.iebc_offices o
    WHERE o.latitude IS NOT NULL AND o.longitude IS NOT NULL AND o.verified = true
      AND (search_query = '' OR search_query IS NULL OR
        to_tsvector('english',
          COALESCE(o.county, '') || ' ' || COALESCE(o.constituency_name, '') || ' ' ||
          COALESCE(o.constituency, '') || ' ' || COALESCE(o.office_location, '') || ' ' ||
          COALESCE(o.landmark, '') || ' ' || COALESCE(o.formatted_address, '')
        ) @@ plainto_tsquery('english', search_query))
  ), with_distance AS (
    SELECT tm.*,
      CASE WHEN search_lat IS NOT NULL AND search_lng IS NOT NULL THEN
        (6371 * acos(LEAST(1.0, GREATEST(-1.0,
          cos(radians(search_lat)) * cos(radians(tm.latitude)) *
          cos(radians(tm.longitude) - radians(search_lng)) +
          sin(radians(search_lat)) * sin(radians(tm.latitude))
        ))))::FLOAT
      ELSE NULL END AS distance_km
    FROM text_matches tm
  )
  SELECT wd.id, wd.county, wd.constituency_name, wd.constituency, wd.office_location,
    wd.latitude, wd.longitude, wd.verified, wd.formatted_address, wd.landmark, wd.clean_office_location,
    wd.distance_km, wd.text_rank,
    (wd.text_rank * CASE WHEN wd.distance_km IS NULL THEN 1.0
      WHEN wd.distance_km = 0 THEN 10.0 ELSE 1.0 / (1.0 + wd.distance_km / 10.0) END)::FLOAT AS combined_score
  FROM with_distance wd WHERE wd.distance_km IS NULL OR wd.distance_km <= radius_km
  ORDER BY combined_score DESC LIMIT max_results;
END;
$$;


-- ============================================================================
-- MIGRATION 12: Harmonize RPCs (20260320)
-- Legacy nearby_offices wrapper + unified charge_usage billing
-- ============================================================================

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
    WHERE proname = 'nearby_offices' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.nearby_offices(
  user_lat DECIMAL, user_lng DECIMAL, radius_km DECIMAL DEFAULT 50
) RETURNS TABLE (
  id INTEGER, county TEXT, constituency_name TEXT, office_location TEXT,
  latitude DECIMAL, longitude DECIMAL, distance_km DECIMAL,
  formatted_address TEXT, verified BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT f.id, f.county, f.constituency_name, f.office_location,
    f.latitude, f.longitude, f.distance_km, f.formatted_address, f.verified
  FROM public.find_offices_near_place(
    search_lat := user_lat, search_lng := user_lng,
    radius_km := radius_km, max_results := 50
  ) f;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.charge_usage(p_key_id UUID, p_endpoint_weight INTEGER DEFAULT 1)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER, limit_type TEXT, reason TEXT) AS $$
DECLARE
  v_tier TEXT; v_plan_status TEXT; v_is_locked BOOLEAN;
  v_credits INTEGER; v_monthly_count INTEGER; v_monthly_limit INTEGER;
  v_current_period_end TIMESTAMPTZ; v_monthly_reset_date DATE;
BEGIN
  SELECT ak.tier, ak.plan_status, ak.is_locked, ak.credits_balance,
    ak.monthly_request_count, ak.current_period_end, ak.monthly_reset_date
  INTO v_tier, v_plan_status, v_is_locked, v_credits, v_monthly_count,
    v_current_period_end, v_monthly_reset_date
  FROM public.api_keys ak WHERE ak.id = p_key_id FOR UPDATE;

  IF NOT FOUND THEN RETURN QUERY SELECT false, 0, 'unknown'::TEXT, 'Key not found'::TEXT; RETURN; END IF;
  IF v_is_locked THEN RETURN QUERY SELECT false, 0, 'locked'::TEXT, 'Key is locked'::TEXT; RETURN; END IF;
  IF v_plan_status NOT IN ('active', 'non_renewing') THEN
    RETURN QUERY SELECT false, 0, 'inactive'::TEXT, ('Plan status: ' || v_plan_status)::TEXT; RETURN;
  END IF;

  IF v_monthly_reset_date IS NOT NULL AND CURRENT_DATE > v_monthly_reset_date THEN
    UPDATE public.api_keys SET monthly_request_count = 0,
      monthly_reset_date = v_monthly_reset_date + INTERVAL '1 month' WHERE id = p_key_id;
    v_monthly_count := 0;
  END IF;

  v_monthly_limit := public.get_tier_monthly_limit(v_tier);

  IF v_tier IN ('enterprise', 'serikali') OR v_credits > 0 THEN
    IF v_credits < p_endpoint_weight THEN
      RETURN QUERY SELECT false, v_credits, 'credits'::TEXT, 'Insufficient credits'::TEXT; RETURN;
    END IF;
    UPDATE public.api_keys SET credits_balance = credits_balance - p_endpoint_weight,
      requests_today = requests_today + 1, last_used_at = NOW() WHERE id = p_key_id;
    RETURN QUERY SELECT true, (v_credits - p_endpoint_weight), 'credits'::TEXT, 'OK'::TEXT;
  ELSE
    IF v_monthly_count >= v_monthly_limit THEN
      RETURN QUERY SELECT false, (v_monthly_limit - v_monthly_count), 'requests'::TEXT, 'Monthly limit reached'::TEXT; RETURN;
    END IF;
    UPDATE public.api_keys SET monthly_request_count = monthly_request_count + p_endpoint_weight,
      requests_today = requests_today + 1, last_used_at = NOW() WHERE id = p_key_id;
    RETURN QUERY SELECT true, (v_monthly_limit - v_monthly_count - p_endpoint_weight), 'requests'::TEXT, 'OK'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- MIGRATION 13: Final Harmonization (20260321) — IEBC ONLY
-- Ward-aware schema + v2 search RPC (Diaspora ALTERs EXCLUDED)
-- ============================================================================

ALTER TABLE public.wards
  ADD COLUMN IF NOT EXISTS total_voters INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS geocode_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS geocode_method TEXT,
  ADD COLUMN IF NOT EXISTS geocode_confidence DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS formatted_address TEXT;

ALTER TABLE public.iebc_offices
  ADD COLUMN IF NOT EXISTS ward TEXT,
  ADD COLUMN IF NOT EXISTS ward_id UUID;

CREATE OR REPLACE FUNCTION search_offices_by_text_and_location_v2(
  search_query TEXT, search_lat FLOAT DEFAULT NULL, search_lng FLOAT DEFAULT NULL,
  radius_km FLOAT DEFAULT 50, max_results INT DEFAULT 10
) RETURNS TABLE (
  id INTEGER, county TEXT, constituency_name TEXT, constituency TEXT, ward TEXT,
  office_location TEXT, latitude FLOAT, longitude FLOAT, verified BOOLEAN,
  formatted_address TEXT, landmark TEXT, distance_km FLOAT, text_rank FLOAT, combined_score FLOAT
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  WITH text_matches AS (
    SELECT o.id, o.county, o.constituency_name, o.constituency, o.ward, o.office_location,
      o.latitude, o.longitude, o.verified, o.formatted_address, o.landmark,
      ts_rank(to_tsvector('english',
        COALESCE(o.county, '') || ' ' || COALESCE(o.constituency_name, '') || ' ' ||
        COALESCE(o.constituency, '') || ' ' || COALESCE(o.ward, '') || ' ' ||
        COALESCE(o.office_location, '') || ' ' || COALESCE(o.landmark, '') || ' ' ||
        COALESCE(o.formatted_address, '')
      ), plainto_tsquery('english', search_query))::FLOAT AS text_rank
    FROM public.iebc_offices o
    WHERE o.latitude IS NOT NULL AND o.longitude IS NOT NULL
      AND (search_query = '' OR search_query IS NULL OR
        to_tsvector('english',
          COALESCE(o.county, '') || ' ' || COALESCE(o.constituency_name, '') || ' ' ||
          COALESCE(o.constituency, '') || ' ' || COALESCE(o.ward, '') || ' ' ||
          COALESCE(o.office_location, '') || ' ' || COALESCE(o.landmark, '') || ' ' ||
          COALESCE(o.formatted_address, '')
        ) @@ plainto_tsquery('english', search_query))
  ), with_distance AS (
    SELECT tm.*,
      CASE WHEN search_lat IS NOT NULL AND search_lng IS NOT NULL THEN
        (6371 * acos(LEAST(1.0, GREATEST(-1.0,
          cos(radians(search_lat)) * cos(radians(tm.latitude)) *
          cos(radians(tm.longitude) - radians(search_lng)) +
          sin(radians(search_lat)) * sin(radians(tm.latitude))
        ))))::FLOAT
      ELSE NULL END AS distance_km
    FROM text_matches tm
  )
  SELECT wd.id, wd.county, wd.constituency_name, wd.constituency, wd.ward, wd.office_location,
    wd.latitude, wd.longitude, wd.verified, wd.formatted_address, wd.landmark,
    wd.distance_km, wd.text_rank,
    (wd.text_rank * CASE WHEN wd.distance_km IS NULL THEN 1.0
      WHEN wd.distance_km = 0 THEN 10.0 ELSE 1.0 / (1.0 + wd.distance_km / 10.0) END)::FLOAT AS combined_score
  FROM with_distance wd WHERE wd.distance_km IS NULL OR wd.distance_km <= radius_km
  ORDER BY combined_score DESC LIMIT max_results;
END;
$$;


-- ============================================================================
-- MIGRATION 14: Spatial Routing RPC (20260321)
-- get_nearest_ward for geographical slug resolution
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE OR REPLACE FUNCTION public.get_nearest_ward(lat_param double precision, lng_param double precision)
RETURNS TABLE (
    id uuid, ward_name text, constituency text, county text,
    latitude double precision, longitude double precision, distance_km double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT w.id, w.ward_name, w.constituency, w.county, w.latitude, w.longitude,
        (6371 * acos(cos(radians(lat_param)) * cos(radians(w.latitude)) *
          cos(radians(w.longitude) - radians(lng_param)) +
          sin(radians(lat_param)) * sin(radians(w.latitude)))) as distance_km
    FROM public.wards w WHERE w.latitude IS NOT NULL AND w.longitude IS NOT NULL
    ORDER BY (point(w.longitude, w.latitude) <-> point(lng_param, lat_param)) ASC LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION public.get_nearest_ward(double precision, double precision) TO anon;
GRANT EXECUTE ON FUNCTION public.get_nearest_ward(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_nearest_ward(double precision, double precision) TO service_role;


-- ============================================================================
-- MIGRATION 15: Ward Schema Enhancement (20260321) — IEBC ONLY
-- Ward geocoding metadata + unique constraints (Diaspora ALTERs EXCLUDED)
-- ============================================================================

ALTER TABLE public.wards
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geocode_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS geocode_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS geocode_method TEXT,
  ADD COLUMN IF NOT EXISTS multi_source_confidence DECIMAL(5,4),
  ADD COLUMN IF NOT EXISTS geocode_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS formatted_address TEXT;

CREATE INDEX IF NOT EXISTS idx_wards_lat_lng ON public.wards(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_wards_hierarchy ON public.wards(county, constituency, ward_name);

ALTER TABLE public.iebc_offices
  ADD COLUMN IF NOT EXISTS ward TEXT,
  ADD COLUMN IF NOT EXISTS ward_id UUID REFERENCES public.wards(id);

CREATE INDEX IF NOT EXISTS idx_iebc_offices_ward ON public.iebc_offices(ward);
CREATE INDEX IF NOT EXISTS idx_iebc_offices_ward_id ON public.iebc_offices(ward_id);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'counties_name_key') THEN
        ALTER TABLE public.counties ADD CONSTRAINT counties_name_key UNIQUE (name);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'constituencies_name_county_key') THEN
        ALTER TABLE public.constituencies ADD CONSTRAINT constituencies_name_county_key UNIQUE (name, county_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wards_full_path_key') THEN
        ALTER TABLE public.wards ADD CONSTRAINT wards_full_path_key UNIQUE (ward_name, constituency, county);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_ward_metadata()
RETURNS VOID AS $$
BEGIN
    UPDATE public.wards SET total_voters = COALESCE(total_count, registration_target, 0) WHERE total_voters = 0;
END;
$$ LANGUAGE plpgsql;

SELECT public.refresh_ward_metadata();


-- ============================================================================
-- MIGRATION 16: Confirmations Enhancement (20260327)
-- Adds office_id, user_id, is_accurate, notes for verified-by badges
-- ============================================================================

ALTER TABLE confirmations ADD COLUMN IF NOT EXISTS office_id INTEGER REFERENCES iebc_offices(id);
ALTER TABLE confirmations ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE confirmations ADD COLUMN IF NOT EXISTS is_accurate BOOLEAN DEFAULT true;
ALTER TABLE confirmations ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_confirmations_office_verified
  ON confirmations(office_id, is_accurate) WHERE is_accurate = true;
CREATE INDEX IF NOT EXISTS idx_confirmations_user_id
  ON confirmations(user_id) WHERE user_id IS NOT NULL;


COMMIT;
