-- Fix the is_break_reminder_due function to use correct column names
DROP FUNCTION IF EXISTS is_break_reminder_due(INTEGER, break_type_enum);

CREATE FUNCTION is_break_reminder_due(p_agent_user_id INTEGER, p_break_type break_type_enum)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    shift_info RECORD;
    break_windows RECORD;
    current_time_only TIME;
    minutes_since_start INTEGER;
    minutes_until_end INTEGER;
    last_notification_time TIMESTAMP;
    minutes_since_last_notification INTEGER;
BEGIN
    -- Shift info
    SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
    IF NOT FOUND OR shift_info.shift_time IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get break windows
    SELECT * INTO break_windows FROM calculate_break_windows(p_agent_user_id) 
    WHERE break_type = p_break_type LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN FALSE; -- No break window for this type
    END IF;
    
    -- Current time (Manila timezone)
    current_time_only := (NOW() AT TIME ZONE 'Asia/Manila')::TIME;
    
    -- Check if current time is within break window
    IF current_time_only < break_windows.start_time OR current_time_only > break_windows.end_time THEN
        RETURN FALSE; -- Outside break window
    END IF;
    
    -- Check if break was already taken today
    -- Use agent_user_id and check if end_time is set (indicating break was completed)
    IF EXISTS(
        SELECT 1 FROM break_sessions 
        WHERE agent_user_id = p_agent_user_id 
        AND break_type = p_break_type 
        AND break_date = CURRENT_DATE
        AND end_time IS NOT NULL  -- Break was completed
    ) THEN
        RETURN FALSE; -- Break already taken
    END IF;
    
    -- Calculate time intervals
    minutes_since_start := EXTRACT(EPOCH FROM (current_time_only - break_windows.start_time)) / 60;
    minutes_until_end := EXTRACT(EPOCH FROM (break_windows.end_time - current_time_only)) / 60;
    
    -- Check if it's time for a reminder (every 30 minutes, but not too frequently)
    -- Only send reminder if we're at least 30 minutes into the break window
    IF minutes_since_start < 30 THEN
        RETURN FALSE;
    END IF;
    
    -- Check if we're within 15 minutes of break end (don't send reminders too close to end)
    IF minutes_until_end < 15 THEN
        RETURN FALSE;
    END IF;
    
    -- Check if we've sent a notification in the last 25 minutes (prevent spam)
    SELECT MAX(created_at) INTO last_notification_time
    FROM notifications 
    WHERE user_id = p_agent_user_id 
    AND category = 'break' 
    AND payload->>'break_type' = p_break_type::TEXT
    AND payload->>'reminder_type' = 'missed_break'
    AND created_at > NOW() - INTERVAL '1 hour';
    
    IF last_notification_time IS NOT NULL THEN
        minutes_since_last_notification := EXTRACT(EPOCH FROM (NOW() - last_notification_time)) / 60;
        IF minutes_since_last_notification < 25 THEN
            RETURN FALSE; -- Too soon since last notification
        END IF;
    END IF;
    
    -- Check if current minute aligns with 30-minute intervals (0, 30)
    -- This ensures reminders only at :00 and :30 of each hour
    IF EXTRACT(MINUTE FROM current_time_only) % 30 >= 5 THEN
        RETURN FALSE; -- Not at 30-minute interval
    END IF;
    
    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION is_break_reminder_due(INTEGER, break_type_enum) IS 'Checks if break reminder is due (prevents spam, uses correct column names)';
