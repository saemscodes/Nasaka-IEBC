-- Migration: Multi-Source Consensus Geocoding Tables
-- Adds geocode_audit for traceability and geocode_hitl_queue for admin review

-- ============================================================================
-- 1. GEOCODE AUDIT TABLE — Full traceability of every coordinate resolution
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

COMMENT ON TABLE public.geocode_audit IS 'Audit trail for every coordinate resolution from the multi-source consensus geocoder';

-- ============================================================================
-- 2. HITL QUEUE TABLE — Low-confidence resolutions needing admin review
-- ============================================================================
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

COMMENT ON TABLE public.geocode_hitl_queue IS 'Admin review queue for low-confidence geocode resolutions';

-- ============================================================================
-- 3. ADD geocode_verified columns to iebc_offices
-- ============================================================================
ALTER TABLE public.iebc_offices
    ADD COLUMN IF NOT EXISTS geocode_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS geocode_verified_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS multi_source_confidence DOUBLE PRECISION;

COMMENT ON COLUMN public.iebc_offices.geocode_verified IS 'True if coordinates have passed multi-source consensus verification';
COMMENT ON COLUMN public.iebc_offices.geocode_verified_at IS 'Timestamp of last multi-source verification';
COMMENT ON COLUMN public.iebc_offices.multi_source_confidence IS 'Consensus confidence score from last multi-source geocoding run (0.0-1.0)';

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================
ALTER TABLE public.geocode_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocode_hitl_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on geocode_audit"
    ON public.geocode_audit FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.core_team WHERE core_team.user_id = auth.uid() AND core_team.is_admin = true));

CREATE POLICY "Admins can do everything on geocode_hitl_queue"
    ON public.geocode_hitl_queue FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.core_team WHERE core_team.user_id = auth.uid() AND core_team.is_admin = true));

-- Service role can always access (for Python scripts)
CREATE POLICY "Service role full access on geocode_audit"
    ON public.geocode_audit FOR ALL TO service_role USING (true);

CREATE POLICY "Service role full access on geocode_hitl_queue"
    ON public.geocode_hitl_queue FOR ALL TO service_role USING (true);

-- Enable realtime for HITL queue so admin dashboard gets live updates
ALTER TABLE public.geocode_hitl_queue REPLICA IDENTITY FULL;
