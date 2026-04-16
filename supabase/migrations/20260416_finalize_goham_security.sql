-- ============================================================================
-- NASAKA IEBC: GOHAM SECURITY FINALIZATION
-- 20260416 — Adds exhaustive logging and Admin Dashboard Knobs
-- ============================================================================

-- 1. ADD SEARCH PARAMS TO USAGE LOG
ALTER TABLE public.nasaka_usage_log
  ADD COLUMN IF NOT EXISTS search_params JSONB;

-- 2. CREATE ADMIN CONFIG (KNOBS) TABLE
CREATE TABLE IF NOT EXISTS public.nasaka_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nasaka_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on nasaka_config"
  ON public.nasaka_config FOR ALL TO service_role USING (true);

-- 3. SEED INITIAL KNOBS (Pricing & Surge)
INSERT INTO public.nasaka_config (key, value, description)
VALUES 
('pricing_multipliers', '{
    "peak_surge": 1.5,
    "boundary_multiplier": 10.0,
    "stats_multiplier": 3.0,
    "complex_query_penalty": 1.25,
    "csv_multiplier": 5.0,
    "geojson_multiplier": 8.0,
    "locate_multiplier": 2.0
}'::jsonb, 'Multipliers for weighted credit deduction'),
('peak_window', '{
    "start_hour_eat": 10,
    "end_hour_eat": 16,
    "is_enabled": true
}'::jsonb, 'Window for Peak Hour Surge pricing (UTC+3)'),
('tier_metadata_overrides', '{
    "public": { "max_records": 5, "is_locked": false },
    "jamii": { "max_records": 50, "is_locked": false }
}'::jsonb, 'Runtime overrides for tier behavior')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. UPDATE nasaka_usage_log IP privacy (ensure it remains 16-char hash)
-- (Already handled by application logic, but good to note)
