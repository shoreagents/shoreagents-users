-- Fix get_agent_shift_info function to handle both agent and internal users
-- The current function only checks agent_user_id, but User 1 is Internal type

CREATE OR REPLACE FUNCTION get_agent_shift_info(p_user_id INTEGER)
RETURNS TABLE(user_id INTEGER, shift_time TEXT, shift_period TEXT, shift_schedule TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id as user_id,
        ji.shift_time,
        ji.shift_period,
        ji.shift_schedule
    FROM users u
    LEFT JOIN job_info ji ON (
        (ji.agent_user_id = u.id) OR 
        (ji.internal_user_id = u.id)
    )
    WHERE u.id = p_user_id;
END;
$$;

COMMENT ON FUNCTION get_agent_shift_info(INTEGER) 
    IS 'Gets shift information for both agent and internal users from job_info table';
