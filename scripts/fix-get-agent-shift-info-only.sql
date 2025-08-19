-- Fix 1: Update get_agent_shift_info to NOT use default values
-- Users without shifts should get NULL, not default shift times
CREATE OR REPLACE FUNCTION public.get_agent_shift_info(p_agent_user_id integer)
RETURNS TABLE(user_id integer, shift_time text, shift_period text, shift_schedule text)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        u.id as user_id,
        ji.shift_time,  -- Remove COALESCE - return actual value or NULL
        ji.shift_period, -- Remove COALESCE - return actual value or NULL
        ji.shift_schedule -- Remove COALESCE - return actual value or NULL
    FROM users u
    LEFT JOIN agents a ON u.id = a.user_id
    LEFT JOIN job_info ji ON ji.agent_user_id = a.user_id
    WHERE u.id = p_agent_user_id;
END;
$function$;
