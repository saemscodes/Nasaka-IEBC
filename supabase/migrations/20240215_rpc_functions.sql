-- COMPLETE: Supabase RPC Functions for IEBC System

-- ============================================================================
-- 1. NEARBY OFFICES FUNCTION (Geospatial query)
-- ============================================================================
-- Drop function if it exists with different signature
DROP FUNCTION IF EXISTS public.nearby_offices(DECIMAL, DECIMAL, DECIMAL);

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
  RETURN QUERY
  SELECT 
    o.id,
    o.county,
    o.constituency_name,
    o.office_location,
    o.latitude,
    o.longitude,
    (
      6371 * acos(
        cos(radians(user_lat)) *
        cos(radians(o.latitude)) *
        cos(radians(o.longitude) - radians(user_lng)) +
        sin(radians(user_lat)) *
        sin(radians(o.latitude))
      )
    ) AS distance_km,
    o.formatted_address,
    o.verified
  FROM public.iebc_offices o
  WHERE o.verified = true
    AND o.latitude IS NOT NULL
    AND o.longitude IS NOT NULL
    AND (
      6371 * acos(
        cos(radians(user_lat)) *
        cos(radians(o.latitude)) *
        cos(radians(o.longitude) - radians(user_lng)) +
        sin(radians(user_lat)) *
        sin(radians(o.latitude))
      )
    ) <= radius_km
  ORDER BY distance_km ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 2. FUZZY SEARCH OFFICES FUNCTION
-- ============================================================================
-- Drop function if it exists with different signature
DROP FUNCTION IF EXISTS public.search_offices_fuzzy(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.search_offices_fuzzy(
  search_term TEXT,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id INTEGER,
  county TEXT,
  constituency_name TEXT,
  office_location TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  formatted_address TEXT,
  match_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.county,
    o.constituency_name,
    o.office_location,
    o.latitude,
    o.longitude,
    o.formatted_address,
    (
      CASE 
        WHEN LOWER(o.county) LIKE '%' || LOWER(search_term) || '%' THEN 3.0
        WHEN LOWER(o.constituency_name) LIKE '%' || LOWER(search_term) || '%' THEN 2.5
        WHEN LOWER(o.office_location) LIKE '%' || LOWER(search_term) || '%' THEN 2.0
        WHEN LOWER(o.landmark) LIKE '%' || LOWER(search_term) || '%' THEN 1.5
        WHEN LOWER(o.formatted_address) LIKE '%' || LOWER(search_term) || '%' THEN 1.0
        ELSE 0.5
      END
    ) AS match_score
  FROM public.iebc_offices o
  WHERE o.verified = true
    AND (
      LOWER(o.county) LIKE '%' || LOWER(search_term) || '%' OR
      LOWER(o.constituency_name) LIKE '%' || LOWER(search_term) || '%' OR
      LOWER(o.office_location) LIKE '%' || LOWER(search_term) || '%' OR
      LOWER(o.landmark) LIKE '%' || LOWER(search_term) || '%' OR
      LOWER(o.formatted_address) LIKE '%' || LOWER(search_term) || '%'
    )
  ORDER BY match_score DESC, o.county, o.constituency_name
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 3. GET OFFICE STATISTICS FUNCTION
-- ============================================================================
-- Drop function if it exists with different signature
DROP FUNCTION IF EXISTS public.get_office_stats(INTEGER);

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
  LEFT JOIN public.iebc_office_contributions cont ON o.id = cont.original_office_id
  LEFT JOIN public.confirmations c ON cont.id = c.contribution_id
  LEFT JOIN public.operational_status_history os ON o.id = os.office_id
  LEFT JOIN public.contact_update_requests cu ON o.id = cu.office_id
  WHERE o.id = office_id_param
  GROUP BY o.id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 4. TRENDING CONTRIBUTIONS FUNCTION
-- ============================================================================
-- Drop function if it exists with different signature
DROP FUNCTION IF EXISTS public.get_trending_contributions(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.get_trending_contributions(
  days_back INTEGER DEFAULT 7,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  contribution_id INTEGER,
  office_id INTEGER,
  office_location TEXT,
  county TEXT,
  upvotes BIGINT,
  downvotes BIGINT,
  helpful_votes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE,
  score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS contribution_id,
    c.original_office_id AS office_id,
    c.submitted_office_location AS office_location,
    c.submitted_county AS county,
    COUNT(CASE WHEN cv.vote_type = 'upvote' THEN 1 END) AS upvotes,
    COUNT(CASE WHEN cv.vote_type = 'downvote' THEN 1 END) AS downvotes,
    COUNT(CASE WHEN cv.vote_type = 'helpful' THEN 1 END) AS helpful_votes,
    c.created_at,
    (
      COUNT(CASE WHEN cv.vote_type = 'upvote' THEN 1 END) * 2 +
      COUNT(CASE WHEN cv.vote_type = 'helpful' THEN 1 END) * 1.5 -
      COUNT(CASE WHEN cv.vote_type = 'downvote' THEN 1 END) * 1
    ) AS score
  FROM public.iebc_office_contributions c
  LEFT JOIN public.contribution_votes cv ON c.id = cv.contribution_id
  WHERE c.created_at > NOW() - (days_back || ' days')::INTERVAL
  GROUP BY c.id, c.original_office_id, c.submitted_office_location, c.submitted_county, c.created_at
  ORDER BY score DESC, c.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 5. PENDING CONTRIBUTIONS FUNCTION
-- ============================================================================
-- Drop function if it exists with different signature
DROP FUNCTION IF EXISTS public.get_pending_contributions(INTEGER);

CREATE OR REPLACE FUNCTION public.get_pending_contributions(
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id INTEGER,
  office_id INTEGER,
  submitted_office_location TEXT,
  submitted_county TEXT,
  submitted_constituency TEXT,
  submitted_latitude DECIMAL,
  submitted_longitude DECIMAL,
  confidence_score DECIMAL,
  confirmation_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.original_office_id AS office_id,
    c.submitted_office_location,
    c.submitted_county,
    c.submitted_constituency,
    c.submitted_latitude,
    c.submitted_longitude,
    c.confidence_score,
    COUNT(DISTINCT conf.id)::INTEGER AS confirmation_count,
    c.created_at
  FROM public.iebc_office_contributions c
  LEFT JOIN public.confirmations conf ON c.id = conf.contribution_id
  WHERE c.status = 'pending_review'
  GROUP BY c.id, c.original_office_id, c.submitted_office_location, c.submitted_county, 
           c.submitted_constituency, c.submitted_latitude, c.submitted_longitude, 
           c.confidence_score, c.created_at
  ORDER BY c.confidence_score DESC, confirmation_count DESC, c.created_at ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 6. AUTO-APPROVE CONTACTS FUNCTION (Admin)
-- ============================================================================
-- Drop function if it exists with different signature
DROP FUNCTION IF EXISTS public.auto_approve_contact_updates(INTEGER);

CREATE OR REPLACE FUNCTION public.auto_approve_contact_updates(
  min_confirmations INTEGER DEFAULT 3
)
RETURNS TABLE (
  contact_update_id BIGINT,
  office_id INTEGER,
  phone TEXT,
  email TEXT,
  hours TEXT,
  approval_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cu.id AS contact_update_id,
    cu.office_id,
    cu.phone,
    cu.email,
    cu.hours,
    COUNT(DISTINCT cu2.id) AS approval_count
  FROM public.contact_update_requests cu
  JOIN public.contact_update_requests cu2 ON 
    cu.office_id = cu2.office_id AND
    cu.phone = cu2.phone AND
    cu.email = cu2.email AND
    cu.hours = cu2.hours
  WHERE cu.status = 'pending'
  GROUP BY cu.id, cu.office_id, cu.phone, cu.email, cu.hours
  HAVING COUNT(DISTINCT cu2.id) >= min_confirmations
  ORDER BY approval_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 7. MOST VERIFIED OFFICES FUNCTION
-- ============================================================================
-- Drop function if it exists with different signature
DROP FUNCTION IF EXISTS public.get_most_verified_offices(INTEGER);

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
  JOIN public.iebc_office_contributions cont ON o.id = cont.original_office_id
  JOIN public.confirmations c ON cont.id = c.contribution_id
  WHERE o.verified = true
  GROUP BY o.id, o.county, o.constituency_name
  ORDER BY confirmation_count DESC, avg_weight DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 8. OFFICES NEEDING VERIFICATION FUNCTION
-- ============================================================================
-- Drop function if it exists with different signature
DROP FUNCTION IF EXISTS public.get_offices_needing_verification(INTEGER, INTEGER);

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
  LEFT JOIN public.iebc_office_contributions cont ON o.id = cont.original_office_id
  LEFT JOIN public.confirmations c ON cont.id = c.contribution_id
  WHERE o.verified = true
  GROUP BY o.id, o.county, o.constituency_name, o.created_at
  HAVING COUNT(DISTINCT c.id) < min_confirmations
  ORDER BY confirmation_count ASC, o.created_at ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 9. OFFICES BY STATUS FUNCTION
-- ============================================================================
-- Drop function if it exists with different signature
DROP FUNCTION IF EXISTS public.get_offices_by_status(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.get_offices_by_status(
  status_filter TEXT,
  limit_count INTEGER DEFAULT 100
)
RETURNS TABLE (
  office_id INTEGER,
  county TEXT,
  constituency_name TEXT,
  current_status TEXT,
  reason TEXT,
  reported_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (o.id)
    o.id AS office_id,
    o.county,
    o.constituency_name,
    os.status AS current_status,
    os.reason,
    os.reported_at
  FROM public.iebc_offices o
  JOIN public.operational_status_history os ON o.id = os.office_id
  WHERE os.status = status_filter
    AND o.verified = true
  ORDER BY o.id, os.reported_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 10. BULK VERIFICATION UPDATE FUNCTION (Admin)
-- ============================================================================
-- Drop function if it exists with different signature
DROP FUNCTION IF EXISTS public.bulk_update_verification(INTEGER[], BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.bulk_update_verification(
  office_ids INTEGER[],
  verified_status BOOLEAN,
  verified_by_user TEXT DEFAULT 'admin'
)
RETURNS TABLE (
  office_id INTEGER,
  updated BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  office_id_val INTEGER;
BEGIN
  FOREACH office_id_val IN ARRAY office_ids
  LOOP
    BEGIN
      UPDATE public.iebc_offices
      SET 
        verified = verified_status,
        verified_at = CASE WHEN verified_status THEN NOW() ELSE NULL END,
        verified_by = CASE WHEN verified_status THEN verified_by_user ELSE NULL END,
        updated_at = NOW()
      WHERE id = office_id_val;
      
      RETURN QUERY SELECT office_id_val, true, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT office_id_val, false, SQLERRM::TEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON FUNCTION public.nearby_offices IS 'Find offices within specified radius from user location';
COMMENT ON FUNCTION public.search_offices_fuzzy IS 'Fuzzy text search across office fields with relevance scoring';
COMMENT ON FUNCTION public.get_office_stats IS 'Get comprehensive statistics for a specific office';
COMMENT ON FUNCTION public.get_trending_contributions IS 'Get trending contributions based on votes and recency';
COMMENT ON FUNCTION public.get_pending_contributions IS 'Get contributions pending review with confirmation counts';
COMMENT ON FUNCTION public.auto_approve_contact_updates IS 'Find contact updates that should be auto-approved based on consensus';
COMMENT ON FUNCTION public.get_most_verified_offices IS 'Get offices with highest verification counts';
COMMENT ON FUNCTION public.get_offices_needing_verification IS 'Get offices that need more community verification';
COMMENT ON FUNCTION public.get_offices_by_status IS 'Get offices filtered by operational status';
COMMENT ON FUNCTION public.bulk_update_verification IS 'Bulk update verification status for multiple offices (admin only)';
