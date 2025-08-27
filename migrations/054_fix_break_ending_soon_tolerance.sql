-- Migration 054: Fix break window ending soon tolerance window
-- The current tolerance (13-17 minutes) is too narrow and can miss the exact 15-minute mark
-- We'll expand it to 12-18 minutes to ensure notifications are sent reliably

-- Update the is_break_window_ending_soon function with wider tolerance
CREATE OR REPLACE FUNCTION public.is_break_window_ending_soon(
    p_agent_user_id integer, 
    p_break_type break_type_enum, 
    p_check_time timestamp with time zone DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    shift_info RECORD;
    break_windows RECORD;
    current_time_only TIME;
    break_end_time TIME;
    minutes_until_expiry INTEGER;
    break_already_taken BOOLEAN;
    current_time_manila TIMESTAMP;
BEGIN
    -- Get current Manila time for logic calculations
    current_time_manila := p_check_time AT TIME ZONE 'Asia/Manila';
    
    -- Get agent shift information
    SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
    
    IF NOT FOUND OR shift_info.shift_time IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if break was already taken today
    SELECT EXISTS(
        SELECT 1 FROM break_sessions
        WHERE agent_user_id = p_agent_user_id
        AND break_type = p_break_type
        AND break_date = current_time_manila::DATE
        AND end_time IS NOT NULL
    ) INTO break_already_taken;
    
    IF break_already_taken THEN
        RETURN FALSE; -- Break already taken, no need for ending soon notification
    END IF;
    
    -- Get break windows using user_id
    SELECT * INTO break_windows FROM calculate_break_windows(p_agent_user_id)
    WHERE break_type = p_break_type LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Extract time part from Manila time for accurate comparison
    current_time_only := current_time_manila::TIME;
    break_end_time := break_windows.end_time;
    
    -- Calculate minutes until break window expires
    -- Handle case where current time is after break end time (next day)
    IF current_time_only > break_end_time THEN
        -- Current time is after break end time, so it's already ended
        minutes_until_expiry := 0;
    ELSE
        -- Calculate minutes until end
        minutes_until_expiry := EXTRACT(EPOCH FROM (break_end_time - current_time_only)) / 60;
    END IF;
    
    -- Return true if break window is ending in 15 minutes (with 3-minute tolerance)
    -- This means between 12-18 minutes before the end (expanded from 13-17)
    -- This ensures we catch the notification window even with slight timing variations
    RETURN (minutes_until_expiry >= 12 AND minutes_until_expiry <= 18);
END;
$function$;

-- Add comment for documentation
COMMENT ON FUNCTION public.is_break_window_ending_soon(integer, break_type_enum, timestamp with time zone) 
IS 'Fixed: Expanded tolerance window to 12-18 minutes (from 13-17) to ensure reliable break ending soon notifications';
