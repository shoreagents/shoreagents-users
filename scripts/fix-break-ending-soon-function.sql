-- Fix the is_break_window_ending_soon function to properly detect break windows ending soon
CREATE OR REPLACE FUNCTION is_break_window_ending_soon(
    p_agent_user_id INTEGER,
    p_break_type break_type_enum,
    p_check_time TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    shift_info RECORD;
    break_windows RECORD;
    current_time_only TIME;
    break_end_time TIME;
    minutes_until_expiry INTEGER;
    break_already_taken BOOLEAN;
BEGIN
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
        AND break_date = CURRENT_DATE
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
    
    current_time_only := (p_check_time AT TIME ZONE 'Asia/Manila')::TIME;
    break_end_time := break_windows.end_time;
    
    -- Calculate minutes until break window expires
    minutes_until_expiry := EXTRACT(EPOCH FROM (break_end_time - current_time_only)) / 60;
    
    -- Return true if break window is ending in 15 minutes (with 2-minute tolerance)
    -- This means between 13-17 minutes before the end
    RETURN (minutes_until_expiry >= 13 AND minutes_until_expiry <= 17);
END;
$$;
