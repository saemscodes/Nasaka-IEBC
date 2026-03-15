-- ============================================================================
-- NASAKA IEBC PUBLIC API INFRASTRUCTURE
-- ============================================================================

-- 1. API Keys Table
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

-- 2. API Usage Log Table
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

-- 3. Security & RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on api_keys"
ON public.api_keys FOR ALL TO service_role USING (true);

CREATE POLICY "Service role full access on api_usage_log"
ON public.api_usage_log FOR ALL TO service_role USING (true);

-- 4. RPC Functions for Edge Functions
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash TEXT)
RETURNS TABLE (
    id UUID,
    tier TEXT,
    requests_today INTEGER,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    UPDATE public.api_keys
    SET
        last_used_at = now(),
        requests_today = requests_today + 1,
        requests_this_month = requests_this_month + 1
    WHERE key_hash = p_key_hash AND is_active = true
    RETURNING api_keys.id, api_keys.tier, api_keys.requests_today, api_keys.is_active;
END;
$$ LANGUAGE plpgsql;

-- 5. County Aggregation Function
CREATE OR REPLACE FUNCTION public.get_county_stats()
RETURNS TABLE (
    county TEXT,
    office_count BIGINT,
    mapped_count BIGINT,
    verified_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.county,
        COUNT(o.id) as office_count,
        COUNT(CASE WHEN o.latitude IS NOT NULL THEN 1 END) as mapped_count,
        COUNT(CASE WHEN o.verified = true THEN 1 END) as verified_count
    FROM public.iebc_offices o
    GROUP BY o.county
    ORDER BY o.county ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_usage_key_id ON public.api_usage_log(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage_log(created_at DESC);
