-- Migration 069: Fix meeting functions to include started_automatically column
-- This migration updates the meeting-related functions to work with the new started_automatically column

-- Drop and recreate get_active_meeting function to include started_automatically column
DROP FUNCTION IF EXISTS get_active_meeting(integer);

CREATE FUNCTION get_active_meeting(p_user_id integer)
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
    started_automatically boolean
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
        m.status, -- Return the actual status from the table
        m.is_in_meeting,
        m.started_automatically
    FROM meetings m
    WHERE m.agent_user_id = p_user_id
    AND m.is_in_meeting = TRUE
    ORDER BY m.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate get_meeting_statistics function for consistency
DROP FUNCTION IF EXISTS get_meeting_statistics(integer, integer);

CREATE FUNCTION get_meeting_statistics(p_user_id integer, p_days integer)
RETURNS TABLE(
    total_meetings bigint,
    completed_meetings bigint,
    scheduled_meetings bigint,
    in_progress_meetings bigint,
    cancelled_meetings bigint,
    total_duration_minutes bigint,
    average_duration_minutes numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_meetings,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_meetings,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_meetings,
        COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress_meetings,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_meetings,
        COALESCE(SUM(duration_minutes), 0) as total_duration_minutes,
        COALESCE(AVG(duration_minutes), 0) as average_duration_minutes
    FROM meetings
    WHERE agent_user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '1 day' * p_days;
END;
$$ LANGUAGE plpgsql;

-- Add comments to the updated functions
COMMENT ON FUNCTION get_active_meeting(integer) IS 'Get the currently active meeting for a user, including started_automatically flag';
COMMENT ON FUNCTION get_meeting_statistics(integer, integer) IS 'Get meeting statistics for a user over a specified number of days';
