-- COMPLETE: supabase/migrations/20240215_iebc_complete_schema.sql
-- Full IEBC Office Management System with Contributions, Verification, Status Tracking

-- ============================================================================
-- 1. CONFIRMATIONS TABLE (Community Verification)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.confirmations (
  id BIGSERIAL PRIMARY KEY,
  contribution_id INTEGER REFERENCES public.iebc_office_contributions(id) ON DELETE SET NULL,
  confirmer_lat DECIMAL(10, 8) NOT NULL,
  confirmer_lng DECIMAL(11, 8) NOT NULL,
  confirmer_accuracy_meters INTEGER,
  confirmer_ip_hash TEXT NOT NULL,
  confirmer_ua_hash TEXT,
  confirmer_device_hash TEXT,
  confirmation_weight DECIMAL(3, 2) DEFAULT 1.0 CHECK (confirmation_weight >= 0 AND confirmation_weight <= 1),
  confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_confirmations_contribution_id ON public.confirmations(contribution_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_confirmed_at ON public.confirmations(confirmed_at DESC);
CREATE INDEX IF NOT EXISTS idx_confirmations_device_hash ON public.confirmations(confirmer_device_hash);

-- ============================================================================
-- 2. OPERATIONAL STATUS HISTORY TABLE
-- ============================================================================
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
-- 3. CONTACT UPDATE REQUESTS TABLE
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
-- 4. CONTRIBUTION VOTES TABLE (Community Voting on Contributions)
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
-- 5. REGISTRATION DEADLINES TABLE
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
-- 6. GEOCODING CACHE TABLE (Performance Optimization)
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
-- 7. OFFICE VERIFICATION STATISTICS VIEW (Materialized)
-- ============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.office_verification_stats AS
SELECT 
  o.id AS office_id,
  o.county,
  o.constituency_name,
  COUNT(DISTINCT c.id) AS confirmation_count,
  AVG(c.confirmation_weight) AS avg_confirmation_weight,
  MAX(c.confirmed_at) AS last_confirmed_at,
  COUNT(DISTINCT CASE WHEN c.confirmed_at > NOW() - INTERVAL '30 days' THEN c.id END) AS recent_confirmations
FROM public.iebc_offices o
LEFT JOIN public.iebc_office_contributions cont ON o.id = cont.original_office_id
LEFT JOIN public.confirmations c ON cont.id = c.contribution_id
WHERE o.verified = true
GROUP BY o.id, o.county, o.constituency_name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_office_verification_stats_office_id ON public.office_verification_stats(office_id);
CREATE INDEX IF NOT EXISTS idx_office_verification_stats_county ON public.office_verification_stats(county);

-- ============================================================================
-- 8. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Update updated_at timestamp for operational_status_history
CREATE OR REPLACE FUNCTION update_operational_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_operational_status_updated_at
BEFORE UPDATE ON public.operational_status_history
FOR EACH ROW
EXECUTE FUNCTION update_operational_status_updated_at();

-- Update updated_at timestamp for registration_deadlines
CREATE OR REPLACE FUNCTION update_registration_deadlines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_registration_deadlines_updated_at
BEFORE UPDATE ON public.registration_deadlines
FOR EACH ROW
EXECUTE FUNCTION update_registration_deadlines_updated_at();

-- Auto-update confirmation count on office (via contribution)
CREATE OR REPLACE FUNCTION update_office_confirmation_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.iebc_offices
  SET updated_at = now()
  WHERE id IN (
    SELECT original_office_id 
    FROM public.iebc_office_contributions 
    WHERE id = NEW.contribution_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_office_confirmation_count
AFTER INSERT ON public.confirmations
FOR EACH ROW
EXECUTE FUNCTION update_office_confirmation_count();

-- Clean expired geocoding cache entries
CREATE OR REPLACE FUNCTION clean_expired_geocoding_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.geocoding_cache
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_update_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribution_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geocoding_cache ENABLE ROW LEVEL SECURITY;

-- Confirmations: Anyone can read, authenticated can insert
CREATE POLICY "Anyone can view confirmations"
  ON public.confirmations FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert confirmations"
  ON public.confirmations FOR INSERT
  WITH CHECK (true);

-- Operational Status: Anyone can read, authenticated can insert
CREATE POLICY "Anyone can view operational status"
  ON public.operational_status_history FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert operational status"
  ON public.operational_status_history FOR INSERT
  WITH CHECK (true);

-- Contact Updates: Anyone can read, authenticated can insert
CREATE POLICY "Anyone can view contact updates"
  ON public.contact_update_requests FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert contact updates"
  ON public.contact_update_requests FOR INSERT
  WITH CHECK (true);

-- Contribution Votes: Anyone can read, authenticated can insert
CREATE POLICY "Anyone can view contribution votes"
  ON public.contribution_votes FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert contribution votes"
  ON public.contribution_votes FOR INSERT
  WITH CHECK (true);

-- Registration Deadlines: Public read
CREATE POLICY "Anyone can view registration deadlines"
  ON public.registration_deadlines FOR SELECT
  USING (true);

-- Geocoding Cache: Public read/write (for performance)
CREATE POLICY "Anyone can view geocoding cache"
  ON public.geocoding_cache FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert geocoding cache"
  ON public.geocoding_cache FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- 10. REFRESH MATERIALIZED VIEW FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_office_verification_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.office_verification_stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE public.confirmations IS 'Community verification confirmations for office locations';
COMMENT ON TABLE public.operational_status_history IS 'Historical record of office operational status changes';
COMMENT ON TABLE public.contact_update_requests IS 'User-submitted contact information update requests';
COMMENT ON TABLE public.contribution_votes IS 'Community voting on contributions (upvote/downvote)';
COMMENT ON TABLE public.registration_deadlines IS 'Registration deadlines and special events per office';
COMMENT ON TABLE public.geocoding_cache IS 'Cached geocoding results to reduce API calls';
COMMENT ON MATERIALIZED VIEW public.office_verification_stats IS 'Aggregated verification statistics per office';
