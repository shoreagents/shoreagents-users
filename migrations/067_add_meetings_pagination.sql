-- Add pagination support to get_user_meetings function
-- This will improve performance by only fetching the data needed for the current page

-- Drop and recreate the function with pagination parameters
DROP FUNCTION IF EXISTS get_user_meetings(integer, integer);

CREATE OR REPLACE FUNCTION get_user_meetings(
    p_user_id integer, 
    p_days integer DEFAULT 7,
    p_limit integer DEFAULT 10,
    p_offset integer DEFAULT 0
)
RETURNS TABLE(
    id integer, 
    title character varying, 
    description text, 
    start_time timestamp with time zone, 
    end_time timestamp with time zone, 
    duration_minutes integer, 
    meeting_type character varying, 
    status character varying, 
    is_in_meeting boolean, 
    created_at timestamp with time zone,
    total_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.title,
        m.description,
        m.start_time,
        m.end_time,
        m.duration_minutes,
        m.meeting_type,
        m.status,
        m.is_in_meeting,
        m.created_at,
        COUNT(*) OVER() as total_count
    FROM meetings m
    WHERE m.agent_user_id = p_user_id
    AND m.start_time >= NOW() - INTERVAL '1 day' * p_days
    ORDER BY m.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Add comment to the function
COMMENT ON FUNCTION get_user_meetings(integer, integer, integer, integer) IS 'Gets user meetings for the specified number of days with pagination support';

-- Also create a function to get total count for pagination
CREATE OR REPLACE FUNCTION get_user_meetings_count(
    p_user_id integer, 
    p_days integer DEFAULT 7
)
RETURNS bigint AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM meetings m
        WHERE m.agent_user_id = p_user_id
        AND m.start_time >= NOW() - INTERVAL '1 day' * p_days
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_meetings_count(integer, integer) IS 'Gets total count of user meetings for pagination';
