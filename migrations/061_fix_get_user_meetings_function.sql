-- Fix get_user_meetings function to remove actual_start_time reference
-- This function is used by the meetings API endpoint

-- Drop and recreate the function without actual_start_time
DROP FUNCTION IF EXISTS get_user_meetings(integer, integer);

CREATE OR REPLACE FUNCTION get_user_meetings(p_user_id integer, p_days integer DEFAULT 7)
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
    created_at timestamp with time zone
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
        m.created_at
    FROM meetings m
    WHERE m.agent_user_id = p_user_id
    AND m.created_at >= NOW() - INTERVAL '1 day' * p_days
    ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Add comment to the function
COMMENT ON FUNCTION get_user_meetings(integer, integer) IS 'Gets user meetings for the specified number of days, without actual_start_time column';
