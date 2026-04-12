-- 20260401_search_rpc.sql
-- Lightweight server-side search for IEBC offices/centres

-- Drop existing if needed
DROP FUNCTION IF EXISTS get_search_suggestions(text);

CREATE OR REPLACE FUNCTION get_search_suggestions(query_text TEXT)
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    category TEXT,
    office_type TEXT,
    constituency_name TEXT,
    ward TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id::BIGINT,
        COALESCE(o.clean_office_location, o.office_location) as name,
        o.latitude,
        o.longitude,
        o.category,
        o.office_type,
        o.constituency_name,
        o.ward
    FROM iebc_offices o
    WHERE 
        (o.office_location ILIKE '%' || query_text || '%') OR
        (o.clean_office_location ILIKE '%' || query_text || '%') OR
        (o.constituency_name ILIKE '%' || query_text || '%') OR
        (o.ward ILIKE '%' || query_text || '%')
    LIMIT 20; -- Keep it lightweight for suggestions
END;
$$;

-- Add comments for postgrest
COMMENT ON FUNCTION get_search_suggestions(TEXT) IS 'Lightweight search for IEBC offices and centres, returning only minimal data for UI suggestions and fly-to actions.';
