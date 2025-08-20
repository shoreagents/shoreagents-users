-- Fix the duplicate is_break_reminder_due functions and timezone issues
-- Drop all existing versions and create one clean version

-- Drop all existing versions of is_break_reminder_due
DROP FUNCTION IF EXISTS is_break_reminder_due(INTEGER, break_type_enum);
DROP FUNCTION IF EXISTS is_break_reminder_due(INTEGER, break_type_enum, TIMESTAMP WITHOUT TIME ZONE);
DROP FUNCTION IF EXISTS is_break_reminder_due(INTEGER, break_type_enum, TIMESTAMP WITH TIME ZONE);

-- Create a single, clean version that works with all break types
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

    -- Extract time part directly from the input timestamp (NO UTC conversion)
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

    -- Don't send notification if one was sent within the last 20 minutes
    IF last_notification_time IS NOT NULL AND 
       EXTRACT(EPOCH FROM (p_check_time - last_notification_time)) / 60 < 20 THEN
        RETURN FALSE;
    END IF;

    -- Return true if it's been 30 minutes since break started (with 5-minute tolerance)
    -- This triggers at 30-minute intervals
    RETURN (minutes_since_start >= 28 AND minutes_since_start <= 32);
END;
$$;
