-- Fix get_active_meeting function to remove actual_start_time reference
-- This function is used by the meeting status API endpoint

-- Drop and recreate the function without actual_start_time
DROP FUNCTION IF EXISTS get_active_meeting(integer);

CREATE OR REPLACE FUNCTION get_active_meeting(p_user_id integer)
RETURNS TABLE(
    id integer, 
    title character varying, 
    description text, 
    start_time timestamp with time zone, 
    end_time timestamp with time zone, 
    duration_minutes integer, 
    meeting_type character varying, 
    status character varying, 
    is_in_meeting boolean
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
        m.is_in_meeting
    FROM meetings m
    WHERE m.agent_user_id = p_user_id
    AND m.status = 'in-progress'
    AND m.is_in_meeting = TRUE
    ORDER BY m.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Add comment to the function
COMMENT ON FUNCTION get_active_meeting(integer) IS 'Gets the active meeting for a user, without actual_start_time column';
