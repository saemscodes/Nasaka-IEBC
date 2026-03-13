-- ============================================================================
-- NASAKA IEBC COMPREHENSIVE DATABASE UPGRADE (STRICT MODE)
-- VERSION: 2026-03-13.v1
-- PURPOSE: Restore Parity with latest snapshot (context/backup.sql)
-- ============================================================================

-- START TRANSACTION
BEGIN;

-- ============================================================================
-- 1. ADMIN & HITL INFRASTRUCTURE (From March 2026 Migrations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type TEXT NOT NULL, 
    status TEXT NOT NULL DEFAULT 'pending', 
    params JSONB DEFAULT '{}',
    proposed_changes JSONB DEFAULT '[]',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.admin_task_logs (
    id BIGSERIAL PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.admin_tasks(id) ON DELETE CASCADE,
    level TEXT NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- ============================================================================
-- 2. GEOCODE AUDIT & HITL QUEUE (From March 2026 Migrations)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- ============================================================================
-- 3. SNAPSHOT-ONLY INFRASTRUCTURE (From context/backup.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.geocoding_cache (
    id BIGSERIAL PRIMARY KEY,
    query_text TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    latitude NUMERIC(10,8) NOT NULL,
    longitude NUMERIC(11,8) NOT NULL,
    formatted_address TEXT,
    geocode_service TEXT NOT NULL,
    confidence_score NUMERIC(3,2),
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

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

CREATE TABLE IF NOT EXISTS public.operational_status_history (
    id BIGSERIAL PRIMARY KEY,
    office_id BIGINT REFERENCES public.iebc_offices(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    notes TEXT,
    reported_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    verified BOOLEAN DEFAULT false,
    verified_by TEXT,
    verified_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.registration_deadlines (
    id BIGSERIAL PRIMARY KEY,
    office_id INTEGER NOT NULL REFERENCES public.iebc_offices(id) ON DELETE CASCADE,
    deadline_type TEXT NOT NULL CHECK (deadline_type IN ('voter_registration', 'candidate_registration', 'special_event')),
    deadline_date DATE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- ============================================================================
-- 4. COLUMNS UPGRADES (iebc_offices)
-- ============================================================================

ALTER TABLE public.iebc_offices
    -- Geo-consensus columns
    ADD COLUMN IF NOT EXISTS geocode_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS geocode_verified_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS multi_source_confidence DOUBLE PRECISION,
    -- API Integration columns
    ADD COLUMN IF NOT EXISTS elevation_meters NUMERIC,
    ADD COLUMN IF NOT EXISTS isochrone_15min JSONB,
    ADD COLUMN IF NOT EXISTS isochrone_30min JSONB,
    ADD COLUMN IF NOT EXISTS isochrone_45min JSONB,
    ADD COLUMN IF NOT EXISTS landmark_normalized TEXT,
    ADD COLUMN IF NOT EXISTS landmark_source TEXT,
    ADD COLUMN IF NOT EXISTS walking_effort TEXT CHECK (walking_effort IN ('low', 'moderate', 'high', 'extreme'));

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_geocode_audit_office ON public.geocode_audit(office_id);
CREATE INDEX IF NOT EXISTS idx_hitl_queue_status ON public.geocode_hitl_queue(status);
CREATE INDEX IF NOT EXISTS idx_geocoding_log_service ON public.geocoding_service_log(service_name);
CREATE INDEX IF NOT EXISTS idx_geocoding_log_created ON public.geocoding_service_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iebc_offices_walking_effort ON public.iebc_offices(walking_effort);
CREATE INDEX IF NOT EXISTS idx_iebc_offices_elevation ON public.iebc_offices(elevation_meters);

-- ============================================================================
-- 6. SECURITY (RLS & POLICIES)
-- ============================================================================

ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocode_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocode_hitl_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocoding_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocoding_service_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_deadlines ENABLE ROW LEVEL SECURITY;

-- ADMIN ONLY POLICIES
DROP POLICY IF EXISTS "Admins can do everything on admin_tasks" ON public.admin_tasks;
CREATE POLICY "Admins can do everything on admin_tasks"
    ON public.admin_tasks FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.core_team WHERE user_id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Admins can do everything on admin_task_logs" ON public.admin_task_logs;
CREATE POLICY "Admins can do everything on admin_task_logs"
    ON public.admin_task_logs FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.core_team WHERE user_id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Admins can do everything on geocode_audit" ON public.geocode_audit;
CREATE POLICY "Admins can do everything on geocode_audit"
    ON public.geocode_audit FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.core_team WHERE user_id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Admins can do everything on geocode_hitl_queue" ON public.geocode_hitl_queue;
CREATE POLICY "Admins can do everything on geocode_hitl_queue"
    ON public.geocode_hitl_queue FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.core_team WHERE user_id = auth.uid() AND is_admin = true));

-- PUBLIC READ / SERVICE INSERT POLICIES
DROP POLICY IF EXISTS "Anyone can view operational status" ON public.operational_status_history;
CREATE POLICY "Anyone can view operational status" ON public.operational_status_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view registration deadlines" ON public.registration_deadlines;
CREATE POLICY "Anyone can view registration deadlines" ON public.registration_deadlines FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view geocoding cache" ON public.geocoding_cache;
CREATE POLICY "Anyone can view geocoding cache" ON public.geocoding_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can view geocoding logs" ON public.geocoding_service_log;
CREATE POLICY "Anyone can view geocoding logs" ON public.geocoding_service_log FOR SELECT USING (true);

-- SERVICE ROLE ACCESS (For Python Pipelines)
DROP POLICY IF EXISTS "Service role full access on geocode_audit" ON public.geocode_audit;
CREATE POLICY "Service role full access on geocode_audit" ON public.geocode_audit FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Service role full access on geocode_hitl_queue" ON public.geocode_hitl_queue;
CREATE POLICY "Service role full access on geocode_hitl_queue" ON public.geocode_hitl_queue FOR ALL TO service_role USING (true);

-- ============================================================================
-- 7. REALTIME SETTINGS
-- ============================================================================

ALTER TABLE public.admin_task_logs REPLICA IDENTITY FULL;
ALTER TABLE public.geocode_hitl_queue REPLICA IDENTITY FULL;

-- ============================================================================
-- 8. RPC FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_offices_by_walking_effort(TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.get_offices_by_walking_effort(effort_level TEXT, limit_count INTEGER DEFAULT 50)
RETURNS TABLE (id INTEGER, county TEXT, constituency_name TEXT, office_location TEXT, latitude DECIMAL, longitude DECIMAL, elevation_meters NUMERIC, walking_effort TEXT, landmark_normalized TEXT) AS $$
BEGIN
  RETURN QUERY SELECT o.id, o.county, o.constituency_name, o.office_location, o.latitude, o.longitude, o.elevation_meters, o.walking_effort, o.landmark_normalized
  FROM public.iebc_offices o WHERE o.verified = true AND o.walking_effort = effort_level AND o.latitude IS NOT NULL AND o.longitude IS NOT NULL
  ORDER BY o.elevation_meters DESC NULLS LAST LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

DROP FUNCTION IF EXISTS public.get_office_isochrone(INTEGER);
CREATE OR REPLACE FUNCTION public.get_office_isochrone(office_id_param INTEGER)
RETURNS TABLE (id INTEGER, county TEXT, constituency_name TEXT, latitude DECIMAL, longitude DECIMAL, elevation_meters NUMERIC, walking_effort TEXT, landmark_normalized TEXT, isochrone_15min JSONB, isochrone_30min JSONB, isochrone_45min JSONB) AS $$
BEGIN
  RETURN QUERY SELECT o.id, o.county, o.constituency_name, o.latitude, o.longitude, o.elevation_meters, o.walking_effort, o.landmark_normalized, o.isochrone_15min, o.isochrone_30min, o.isochrone_45min
  FROM public.iebc_offices o WHERE o.id = office_id_param AND o.verified = true;
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
-- END TRANSACTION
