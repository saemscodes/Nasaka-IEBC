-- COMPLETE: RPC Functions Update for Schema Reconciliation
-- Updates existing RPC functions to work with reconciled schema
-- Date: 2024-02-16

-- ============================================================================
-- 1. UPDATE get_office_stats TO HANDLE NULL office_id IN confirmations
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_office_stats(office_id_param INTEGER)
RETURNS TABLE (
  office_id INTEGER,
  confirmation_count BIGINT,
  avg_confirmation_weight DECIMAL,
  last_confirmed_at TIMESTAMP WITH TIME ZONE,
  recent_confirmations BIGINT,
  status_reports_count BIGINT,
  contact_updates_count BIGINT,
  contributions_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id AS office_id,
    COUNT(DISTINCT c.id) AS confirmation_count,
    AVG(c.confirmation_weight) AS avg_confirmation_weight,
    MAX(c.confirmed_at) AS last_confirmed_at,
    COUNT(DISTINCT CASE WHEN c.confirmed_at > NOW() - INTERVAL '30 days' THEN c.id END) AS recent_confirmations,
    COUNT(DISTINCT os.id) AS status_reports_count,
    COUNT(DISTINCT cu.id) AS contact_updates_count,
    COUNT(DISTINCT cont.id) AS contributions_count
  FROM public.iebc_offices o
  LEFT JOIN public.confirmations c ON (
    o.id = c.office_id OR 
    (c.contribution_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.iebc_office_contributions cont2 
      WHERE cont2.id = c.contribution_id AND cont2.original_office_id = o.id
    ))
  )
  LEFT JOIN public.operational_status_history os ON o.id = os.office_id
  LEFT JOIN public.contact_update_requests cu ON o.id = cu.office_id
  LEFT JOIN public.iebc_office_contributions cont ON o.id = cont.original_office_id
  WHERE o.id = office_id_param
  GROUP BY o.id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 2. UPDATE office_verification_stats MATERIALIZED VIEW
-- ============================================================================
DROP MATERIALIZED VIEW IF EXISTS public.office_verification_stats;

CREATE MATERIALIZED VIEW public.office_verification_stats AS
SELECT 
  o.id AS office_id,
  o.county,
  o.constituency_name,
  COUNT(DISTINCT c.id) AS confirmation_count,
  AVG(c.confirmation_weight) AS avg_confirmation_weight,
  MAX(c.confirmed_at) AS last_confirmed_at,
  COUNT(DISTINCT CASE WHEN c.confirmed_at > NOW() - INTERVAL '30 days' THEN c.id END) AS recent_confirmations
FROM public.iebc_offices o
LEFT JOIN public.confirmations c ON (
  o.id = c.office_id OR 
  (c.contribution_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.iebc_office_contributions cont 
    WHERE cont.id = c.contribution_id AND cont.original_office_id = o.id
  ))
)
WHERE o.verified = true
GROUP BY o.id, o.county, o.constituency_name;

CREATE UNIQUE INDEX idx_office_verification_stats_office_id ON public.office_verification_stats(office_id);
CREATE INDEX idx_office_verification_stats_county ON public.office_verification_stats(county);

-- ============================================================================
-- 3. NEW FUNCTION: GET ARCHIVED CONTRIBUTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_archived_contributions(
  p_action_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  contribution_id INTEGER,
  original_office_id INTEGER,
  action_type TEXT,
  actor TEXT,
  archive_reason TEXT,
  action_timestamp TIMESTAMP WITH TIME ZONE,
  archived_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ca.id,
    ca.contribution_id,
    ca.original_office_id,
    ca.action_type,
    ca.actor,
    ca.archive_reason,
    ca.action_timestamp,
    ca.archived_data
  FROM public.contribution_archive ca
  WHERE (p_action_type IS NULL OR ca.action_type = p_action_type)
  ORDER BY ca.action_timestamp DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 4. NEW FUNCTION: GET VERIFICATION LOG FOR OFFICE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_office_verification_log(
  p_office_id INTEGER,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  action TEXT,
  actor TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vl.id,
    vl.action,
    vl.actor,
    vl.details,
    vl.created_at
  FROM public.verification_log vl
  WHERE vl.office_id = p_office_id
  ORDER BY vl.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 5. NEW FUNCTION: GET VERIFICATION LOG FOR CONTRIBUTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_contribution_verification_log(
  p_contribution_id INTEGER,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  action TEXT,
  actor TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vl.id,
    vl.action,
    vl.actor,
    vl.details,
    vl.created_at
  FROM public.verification_log vl
  WHERE vl.contribution_id = p_contribution_id
  ORDER BY vl.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 6. NEW FUNCTION: GET OFFICE CONTRIBUTION LINKS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_office_contribution_links(
  p_office_id INTEGER
)
RETURNS TABLE (
  contribution_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ocl.contribution_id,
    ocl.created_at
  FROM public.office_contribution_links ocl
  WHERE ocl.office_id = p_office_id
  ORDER BY ocl.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 7. UPDATE get_most_verified_offices TO HANDLE NULL office_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_most_verified_offices(
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  office_id INTEGER,
  county TEXT,
  constituency_name TEXT,
  confirmation_count BIGINT,
  avg_weight DECIMAL,
  last_confirmed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id AS office_id,
    o.county,
    o.constituency_name,
    COUNT(DISTINCT c.id) AS confirmation_count,
    AVG(c.confirmation_weight) AS avg_weight,
    MAX(c.confirmed_at) AS last_confirmed_at
  FROM public.iebc_offices o
  JOIN public.confirmations c ON (
    o.id = c.office_id OR 
    (c.contribution_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.iebc_office_contributions cont 
      WHERE cont.id = c.contribution_id AND cont.original_office_id = o.id
    ))
  )
  WHERE o.verified = true
  GROUP BY o.id, o.county, o.constituency_name
  ORDER BY confirmation_count DESC, avg_weight DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 8. UPDATE get_offices_needing_verification TO HANDLE NULL office_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_offices_needing_verification(
  min_confirmations INTEGER DEFAULT 2,
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  office_id INTEGER,
  county TEXT,
  constituency_name TEXT,
  confirmation_count BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  last_confirmed_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id AS office_id,
    o.county,
    o.constituency_name,
    COUNT(DISTINCT c.id) AS confirmation_count,
    o.created_at,
    MAX(c.confirmed_at) AS last_confirmed_at
  FROM public.iebc_offices o
  LEFT JOIN public.confirmations c ON (
    o.id = c.office_id OR 
    (c.contribution_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.iebc_office_contributions cont 
      WHERE cont.id = c.contribution_id AND cont.original_office_id = o.id
    ))
  )
  WHERE o.verified = true
  GROUP BY o.id, o.county, o.constituency_name, o.created_at
  HAVING COUNT(DISTINCT c.id) < min_confirmations
  ORDER BY confirmation_count ASC, o.created_at ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 9. COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON FUNCTION public.get_archived_contributions IS 'Get archived contributions with optional filtering by action type';
COMMENT ON FUNCTION public.get_office_verification_log IS 'Get verification log entries for a specific office';
COMMENT ON FUNCTION public.get_contribution_verification_log IS 'Get verification log entries for a specific contribution';
COMMENT ON FUNCTION public.get_office_contribution_links IS 'Get all contributions linked to a specific office';
