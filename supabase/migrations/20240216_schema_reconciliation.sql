-- COMPLETE: Schema Reconciliation Migration
-- Updates existing tables and creates missing tables to match full database implementation
-- Date: 2024-02-16

-- ============================================================================
-- 1. UPDATE CONFIRMATIONS TABLE to match actual database schema
-- ============================================================================

-- Remove office_id column if it exists (confirmations only link via contribution_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'confirmations' 
    AND column_name = 'office_id'
  ) THEN
    -- Drop dependent objects first
    DROP INDEX IF EXISTS public.idx_confirmations_office_id;
    ALTER TABLE public.confirmations DROP COLUMN office_id;
  END IF;
END $$;

-- Add missing columns to confirmations table
ALTER TABLE public.confirmations
ADD COLUMN IF NOT EXISTS confirmer_distance_meters INTEGER,
ADD COLUMN IF NOT EXISTS geom GEOMETRY(POINT, 4326);

-- Remove created_at if it doesn't exist in actual schema (keeping for now as it's useful)
-- Note: office_id may need to be removed if it doesn't exist in actual schema
-- However, keeping it for now as it's referenced in our RPC functions

-- Create index on geom for spatial queries
CREATE INDEX IF NOT EXISTS idx_confirmations_geom ON public.confirmations USING GIST(geom);

-- Create index on confirmer_distance_meters
CREATE INDEX IF NOT EXISTS idx_confirmations_distance_meters ON public.confirmations(confirmer_distance_meters);

-- Update geom column from lat/lng if geom is null
CREATE OR REPLACE FUNCTION update_confirmations_geom()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.geom IS NULL AND NEW.confirmer_lat IS NOT NULL AND NEW.confirmer_lng IS NOT NULL THEN
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.confirmer_lng, NEW.confirmer_lat), 4326);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_confirmations_geom
BEFORE INSERT OR UPDATE ON public.confirmations
FOR EACH ROW
EXECUTE FUNCTION update_confirmations_geom();

-- ============================================================================
-- 2. CREATE CONTRIBUTION_ARCHIVE TABLE (Missing from our migrations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contribution_archive (
  id BIGSERIAL PRIMARY KEY,
  contribution_id INTEGER NOT NULL REFERENCES public.iebc_office_contributions(id) ON DELETE CASCADE,
  original_office_id INTEGER REFERENCES public.iebc_offices(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('archived', 'deleted', 'merged', 'rejected', 'duplicate')),
  actor TEXT NOT NULL,
  archive_reason TEXT,
  review_notes TEXT,
  archived_data JSONB NOT NULL,
  action_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contribution_archive_contribution_id ON public.contribution_archive(contribution_id);
CREATE INDEX IF NOT EXISTS idx_contribution_archive_original_office_id ON public.contribution_archive(original_office_id);
CREATE INDEX IF NOT EXISTS idx_contribution_archive_action_type ON public.contribution_archive(action_type);
CREATE INDEX IF NOT EXISTS idx_contribution_archive_action_timestamp ON public.contribution_archive(action_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_contribution_archive_actor ON public.contribution_archive(actor);

-- Enable RLS
ALTER TABLE public.contribution_archive ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contribution_archive
CREATE POLICY "Anyone can view contribution archive"
  ON public.contribution_archive FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert contribution archive"
  ON public.contribution_archive FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- 3. CREATE VERIFICATION_LOG TABLE (Missing from our migrations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.verification_log (
  id BIGSERIAL PRIMARY KEY,
  office_id INTEGER REFERENCES public.iebc_offices(id) ON DELETE SET NULL,
  contribution_id INTEGER REFERENCES public.iebc_office_contributions(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('verified', 'rejected', 'pending', 'updated', 'archived', 'merged')),
  actor TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_log_office_id ON public.verification_log(office_id);
CREATE INDEX IF NOT EXISTS idx_verification_log_contribution_id ON public.verification_log(contribution_id);
CREATE INDEX IF NOT EXISTS idx_verification_log_action ON public.verification_log(action);
CREATE INDEX IF NOT EXISTS idx_verification_log_actor ON public.verification_log(actor);
CREATE INDEX IF NOT EXISTS idx_verification_log_created_at ON public.verification_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.verification_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for verification_log
CREATE POLICY "Anyone can view verification log"
  ON public.verification_log FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert verification log"
  ON public.verification_log FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- 4. CREATE OFFICE_CONTRIBUTION_LINKS TABLE (Missing from our migrations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.office_contribution_links (
  id BIGSERIAL PRIMARY KEY,
  office_id INTEGER NOT NULL REFERENCES public.iebc_offices(id) ON DELETE CASCADE,
  contribution_id INTEGER NOT NULL REFERENCES public.iebc_office_contributions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(office_id, contribution_id)
);

CREATE INDEX IF NOT EXISTS idx_office_contribution_links_office_id ON public.office_contribution_links(office_id);
CREATE INDEX IF NOT EXISTS idx_office_contribution_links_contribution_id ON public.office_contribution_links(contribution_id);
CREATE INDEX IF NOT EXISTS idx_office_contribution_links_created_at ON public.office_contribution_links(created_at DESC);

-- Enable RLS
ALTER TABLE public.office_contribution_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for office_contribution_links
CREATE POLICY "Anyone can view office contribution links"
  ON public.office_contribution_links FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert office contribution links"
  ON public.office_contribution_links FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- 5. ENSURE OPERATIONAL_STATUS_HISTORY EXISTS (Our new table)
-- ============================================================================
-- Add missing columns if table already exists from another migration
ALTER TABLE public.operational_status_history
  ADD COLUMN IF NOT EXISTS reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Already created in 20240215_iebc_complete_schema.sql, but ensure it exists
CREATE TABLE IF NOT EXISTS public.operational_status_history (
  id BIGSERIAL PRIMARY KEY,
  office_id INTEGER NOT NULL REFERENCES public.iebc_offices(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('operational', 'closed', 'relocated', 'under_renovation', 'temporary_closed')),
  reason TEXT,
  reported_by TEXT,
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  verified BOOLEAN DEFAULT false,
  verified_by TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_status_office_id ON public.operational_status_history(office_id);
CREATE INDEX IF NOT EXISTS idx_operational_status_reported_at ON public.operational_status_history(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_operational_status_status ON public.operational_status_history(status);

-- ============================================================================
-- 6. ENSURE CONTACT_UPDATE_REQUESTS EXISTS (Our new table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contact_update_requests (
  id BIGSERIAL PRIMARY KEY,
  office_id INTEGER NOT NULL REFERENCES public.iebc_offices(id) ON DELETE CASCADE,
  phone TEXT,
  email TEXT,
  hours TEXT,
  notes TEXT,
  submitted_by TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'implemented')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_update_office_id ON public.contact_update_requests(office_id);
CREATE INDEX IF NOT EXISTS idx_contact_update_status ON public.contact_update_requests(status);
CREATE INDEX IF NOT EXISTS idx_contact_update_submitted_at ON public.contact_update_requests(submitted_at DESC);

-- ============================================================================
-- 7. ENSURE CONTRIBUTION_VOTES EXISTS (Our new table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contribution_votes (
  id BIGSERIAL PRIMARY KEY,
  contribution_id INTEGER NOT NULL REFERENCES public.iebc_office_contributions(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('upvote', 'downvote', 'helpful', 'not_helpful')),
  voter_ip_hash TEXT,
  voter_device_hash TEXT,
  voted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contribution_id, voter_device_hash)
);

CREATE INDEX IF NOT EXISTS idx_contribution_votes_contribution_id ON public.contribution_votes(contribution_id);
CREATE INDEX IF NOT EXISTS idx_contribution_votes_vote_type ON public.contribution_votes(vote_type);
CREATE INDEX IF NOT EXISTS idx_contribution_votes_voted_at ON public.contribution_votes(voted_at DESC);

-- ============================================================================
-- 8. ENSURE REGISTRATION_DEADLINES EXISTS (Our new table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.registration_deadlines (
  id BIGSERIAL PRIMARY KEY,
  office_id INTEGER NOT NULL REFERENCES public.iebc_offices(id) ON DELETE CASCADE,
  deadline_type TEXT NOT NULL CHECK (deadline_type IN ('voter_registration', 'candidate_registration', 'special_event')),
  deadline_date DATE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registration_deadlines_office_id ON public.registration_deadlines(office_id);
CREATE INDEX IF NOT EXISTS idx_registration_deadlines_deadline_date ON public.registration_deadlines(deadline_date);
CREATE INDEX IF NOT EXISTS idx_registration_deadlines_is_active ON public.registration_deadlines(is_active);

-- ============================================================================
-- 9. ENSURE GEOCODING_CACHE EXISTS (Our new table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.geocoding_cache (
  id BIGSERIAL PRIMARY KEY,
  query_text TEXT NOT NULL,
  query_hash TEXT NOT NULL UNIQUE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  formatted_address TEXT,
  geocode_service TEXT NOT NULL,
  confidence_score DECIMAL(3, 2),
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geocoding_cache_query_hash ON public.geocoding_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_geocoding_cache_expires_at ON public.geocoding_cache(expires_at);

-- ============================================================================
-- 10. UPDATE RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Operational Status History RLS (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'operational_status_history'
  ) THEN
    ALTER TABLE public.operational_status_history ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY IF NOT EXISTS "Anyone can view operational status"
      ON public.operational_status_history FOR SELECT
      USING (true);

    CREATE POLICY IF NOT EXISTS "Anyone can insert operational status"
      ON public.operational_status_history FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Contact Update Requests RLS (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contact_update_requests'
  ) THEN
    ALTER TABLE public.contact_update_requests ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY IF NOT EXISTS "Anyone can view contact updates"
      ON public.contact_update_requests FOR SELECT
      USING (true);

    CREATE POLICY IF NOT EXISTS "Anyone can insert contact updates"
      ON public.contact_update_requests FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Contribution Votes RLS (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'contribution_votes'
  ) THEN
    ALTER TABLE public.contribution_votes ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY IF NOT EXISTS "Anyone can view contribution votes"
      ON public.contribution_votes FOR SELECT
      USING (true);

    CREATE POLICY IF NOT EXISTS "Anyone can insert contribution votes"
      ON public.contribution_votes FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Registration Deadlines RLS (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'registration_deadlines'
  ) THEN
    ALTER TABLE public.registration_deadlines ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY IF NOT EXISTS "Anyone can view registration deadlines"
      ON public.registration_deadlines FOR SELECT
      USING (true);
  END IF;
END $$;

-- Geocoding Cache RLS (if not already enabled)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'geocoding_cache'
  ) THEN
    ALTER TABLE public.geocoding_cache ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY IF NOT EXISTS "Anyone can view geocoding cache"
      ON public.geocoding_cache FOR SELECT
      USING (true);

    CREATE POLICY IF NOT EXISTS "Anyone can insert geocoding cache"
      ON public.geocoding_cache FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- 11. CREATE HELPER FUNCTIONS FOR NEW TABLES
-- ============================================================================

-- Function to archive a contribution
CREATE OR REPLACE FUNCTION archive_contribution(
  p_contribution_id INTEGER,
  p_action_type TEXT,
  p_actor TEXT,
  p_archive_reason TEXT DEFAULT NULL,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_archive_id BIGINT;
  v_archived_data JSONB;
BEGIN
  -- Get contribution data
  SELECT row_to_json(c)::JSONB INTO v_archived_data
  FROM public.iebc_office_contributions c
  WHERE c.id = p_contribution_id;

  -- Insert into archive
  INSERT INTO public.contribution_archive (
    contribution_id,
    original_office_id,
    action_type,
    actor,
    archive_reason,
    review_notes,
    archived_data
  )
  SELECT 
    p_contribution_id,
    original_office_id,
    p_action_type,
    p_actor,
    p_archive_reason,
    p_review_notes,
    v_archived_data
  FROM public.iebc_office_contributions
  WHERE id = p_contribution_id
  RETURNING id INTO v_archive_id;

  -- Log verification action
  INSERT INTO public.verification_log (
    contribution_id,
    action,
    actor,
    details
  ) VALUES (
    p_contribution_id,
    'archived',
    p_actor,
    jsonb_build_object(
      'archive_id', v_archive_id,
      'reason', p_archive_reason,
      'notes', p_review_notes
    )
  );

  RETURN v_archive_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log verification actions
CREATE OR REPLACE FUNCTION log_verification(
  p_office_id INTEGER DEFAULT NULL,
  p_contribution_id INTEGER DEFAULT NULL,
  p_action TEXT,
  p_actor TEXT,
  p_details JSONB DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  v_log_id BIGINT;
BEGIN
  INSERT INTO public.verification_log (
    office_id,
    contribution_id,
    action,
    actor,
    details
  ) VALUES (
    p_office_id,
    p_contribution_id,
    p_action,
    p_actor,
    p_details
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to link office and contribution
CREATE OR REPLACE FUNCTION link_office_contribution(
  p_office_id INTEGER,
  p_contribution_id INTEGER
)
RETURNS BIGINT AS $$
DECLARE
  v_link_id BIGINT;
BEGIN
  INSERT INTO public.office_contribution_links (
    office_id,
    contribution_id
  ) VALUES (
    p_office_id,
    p_contribution_id
  )
  ON CONFLICT (office_id, contribution_id) DO NOTHING
  RETURNING id INTO v_link_id;

  RETURN v_link_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 12. COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE public.contribution_archive IS 'Archived contributions with full data snapshot and action history';
COMMENT ON TABLE public.verification_log IS 'Comprehensive log of all verification actions on offices and contributions';
COMMENT ON TABLE public.office_contribution_links IS 'Many-to-many relationship between offices and contributions';
COMMENT ON COLUMN public.confirmations.confirmer_distance_meters IS 'Distance in meters from confirmer location to office location';
COMMENT ON COLUMN public.confirmations.geom IS 'PostGIS geometry point for confirmer location';
COMMENT ON FUNCTION archive_contribution IS 'Archive a contribution with full data snapshot';
COMMENT ON FUNCTION log_verification IS 'Log verification actions for audit trail';
COMMENT ON FUNCTION link_office_contribution IS 'Link an office to a contribution';
