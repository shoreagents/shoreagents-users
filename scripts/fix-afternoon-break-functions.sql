-- Fix all afternoon break notification functions to work properly
-- Apply the same timezone fix that worked for is_break_window_ending_soon

-- Fix is_break_available_soon (for 2:30 PM notification)
CREATE OR REPLACE FUNCTION is_break_available_soon(
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
    break_start_time TIME;
    minutes_until_start INTEGER;
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
        RETURN FALSE;
    END IF;

    -- Get break windows using user_id
    SELECT * INTO break_windows FROM calculate_break_windows(p_agent_user_id)
    WHERE break_type = p_break_type LIMIT 1;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Extract time part directly from the input timestamp (treat as local time)
    current_time_only := p_check_time::TIME;
    break_start_time := break_windows.start_time;

    -- Calculate minutes until break starts
    -- Handle case where current time is after break start time (next day)
    IF current_time_only > break_start_time THEN
        -- Current time is after break start time, so it's already started or passed
        minutes_until_start := 0;
    ELSE
        -- Calculate minutes until start
        minutes_until_start := EXTRACT(EPOCH FROM (break_start_time - current_time_only)) / 60;
    END IF;

    -- Return true if break is available in 15 minutes (with 2-minute tolerance)
    RETURN (minutes_until_start >= 13 AND minutes_until_start <= 17);
END;
$$;

-- Fix is_break_available_now (for 2:45 PM notification)
CREATE OR REPLACE FUNCTION is_break_available_now(
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
    break_start_time TIME;
    break_end_time TIME;
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
        RETURN FALSE;
    END IF;

    -- Get break windows using user_id
    SELECT * INTO break_windows FROM calculate_break_windows(p_agent_user_id)
    WHERE break_type = p_break_type LIMIT 1;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Extract time part directly from the input timestamp (treat as local time)
    current_time_only := p_check_time::TIME;
    break_start_time := break_windows.start_time;
    break_end_time := break_windows.end_time;

    -- Return true if current time is within the break window
    RETURN (current_time_only >= break_start_time AND current_time_only <= break_end_time);
END;
$$;

-- Fix is_break_reminder_due (for 3:15 PM notification - 30 minutes after start)
CREATE OR REPLACE FUNCTION is_break_reminder_due(
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
    break_start_time TIME;
    break_end_time TIME;
    minutes_since_start INTEGER;
    break_already_taken BOOLEAN;
    last_notification_time TIMESTAMP;
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
        RETURN FALSE;
    END IF;

    -- Get break windows using user_id
    SELECT * INTO break_windows FROM calculate_break_windows(p_agent_user_id)
    WHERE break_type = p_break_type LIMIT 1;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Extract time part directly from the input timestamp (treat as local time)
    current_time_only := p_check_time::TIME;
    break_start_time := break_windows.start_time;
    break_end_time := break_windows.end_time;

    -- Check if we're within the break window
    IF NOT (current_time_only >= break_start_time AND current_time_only <= break_end_time) THEN
        RETURN FALSE;
    END IF;

    -- Calculate minutes since break started
    minutes_since_start := EXTRACT(EPOCH FROM (current_time_only - break_start_time)) / 60;

    -- Check for recent notifications to avoid spam
    SELECT MAX(created_at) INTO last_notification_time
    FROM notifications
    WHERE user_id = p_agent_user_id
    AND category = 'break'
    AND type = 'reminder'
    AND created_at > CURRENT_DATE;

    -- Don't send notification if one was sent within the last 25 minutes
    IF last_notification_time IS NOT NULL AND 
       EXTRACT(EPOCH FROM (p_check_time - last_notification_time)) / 60 < 25 THEN
        RETURN FALSE;
    END IF;

    -- Return true if it's been 30 minutes since break started (with 5-minute tolerance)
    -- This triggers at 30-minute intervals: 30min, 60min, etc.
    RETURN (minutes_since_start >= 28 AND minutes_since_start <= 32 AND EXTRACT(MINUTE FROM current_time_only) % 30 >= 5);
END;
$$;
