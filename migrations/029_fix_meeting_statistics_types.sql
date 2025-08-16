-- Fix type mismatch in get_meeting_statistics function
-- The COUNT(*) function returns bigint but the function expects integer

CREATE OR REPLACE FUNCTION get_meeting_statistics(
    p_user_id INTEGER,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    total_meetings INTEGER,
    completed_meetings INTEGER,
    cancelled_meetings INTEGER,
    total_duration_minutes INTEGER,
    avg_duration_minutes NUMERIC,
    today_meetings INTEGER,
    today_duration_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(*)::INTEGER as total_count,
            COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as completed_count,
            COUNT(*) FILTER (WHERE status = 'cancelled')::INTEGER as cancelled_count,
            COALESCE(SUM(duration_minutes), 0)::INTEGER as total_duration,
            COALESCE(AVG(duration_minutes), 0) as avg_duration,
            COUNT(*) FILTER (WHERE DATE(created_at) = now()::date)::INTEGER as today_count,
            COALESCE(SUM(duration_minutes) FILTER (WHERE DATE(created_at) = now()::date), 0)::INTEGER as today_duration
        FROM meetings
        WHERE agent_user_id = p_user_id
        AND created_at >= now()::date - INTERVAL '1 day' * p_days
    )
    SELECT 
        total_count,
        completed_count,
        cancelled_count,
        total_duration,
        avg_duration,
        today_count,
        today_duration
    FROM stats;
END;
$$ LANGUAGE plpgsql; 