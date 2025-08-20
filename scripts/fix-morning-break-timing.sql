-- Fix the calculate_break_windows function to set Morning break as 9:00 AM - 10:00 AM
-- Also fix the reminder function issues

CREATE OR REPLACE FUNCTION calculate_break_windows(p_user_id INTEGER)
RETURNS TABLE(break_type break_type_enum, start_time TIME, end_time TIME)
LANGUAGE plpgsql
AS $$
DECLARE
    shift_info RECORD;
    shift_start_str TEXT;
    shift_end_str TEXT;
    shift_start TIME;
    shift_end TIME;
    shift_duration INTERVAL;
BEGIN
    -- Get shift information
    SELECT * INTO shift_info FROM get_agent_shift_info(p_user_id) LIMIT 1;

    IF NOT FOUND OR shift_info.shift_time IS NULL THEN
        RETURN; -- No shift info, return empty
    END IF;

    -- Simple parsing: split on " - " and extract time parts
    shift_start_str := SPLIT_PART(shift_info.shift_time, ' - ', 1);
    shift_end_str := SPLIT_PART(shift_info.shift_time, ' - ', 2);

    -- Convert to 24-hour format
    shift_start := CASE
        WHEN shift_start_str ~ '(\d{1,2}):(\d{2})\s*AM' THEN
            (REGEXP_REPLACE(shift_start_str, '(\d{1,2}):(\d{2})\s*AM', '\1:\2'))::TIME
        WHEN shift_start_str ~ '(\d{1,2}):(\d{2})\s*PM' THEN
            CASE
                WHEN REGEXP_REPLACE(shift_start_str, '(\d{1,2}):(\d{2})\s*PM', '\1')::INTEGER = 12 THEN
                    (REGEXP_REPLACE(shift_start_str, '(\d{1,2}):(\d{2})\s*PM', '\1:\2'))::TIME
                ELSE
                    ((REGEXP_REPLACE(shift_start_str, '(\d{1,2}):(\d{2})\s*PM', '\1')::INTEGER + 12) || ':' ||
                     REGEXP_REPLACE(shift_start_str, '(\d{1,2}):(\d{2})\s*PM', '\2'))::TIME
            END
        ELSE '00:00'::TIME
    END;

    shift_end := CASE
        WHEN shift_end_str ~ '(\d{1,2}):(\d{2})\s*AM' THEN
            (REGEXP_REPLACE(shift_end_str, '(\d{1,2}):(\d{2})\s*AM', '\1:\2'))::TIME
        WHEN shift_end_str ~ '(\d{1,2}):(\d{2})\s*PM' THEN
            CASE
                WHEN REGEXP_REPLACE(shift_end_str, '(\d{1,2}):(\d{2})\s*PM', '\1')::INTEGER = 12 THEN
                    (REGEXP_REPLACE(shift_end_str, '(\d{1,2}):(\d{2})\s*PM', '\1:\2'))::TIME
                ELSE
                    ((REGEXP_REPLACE(shift_end_str, '(\d{1,2}):(\d{2})\s*PM', '\1')::INTEGER + 12) || ':' ||
                     REGEXP_REPLACE(shift_end_str, '(\d{1,2}):(\d{2})\s*PM', '\2'))::TIME
            END
        ELSE '00:00'::TIME
    END;

    -- Calculate shift duration
    shift_duration := shift_end - shift_start;

    -- Return break windows based on shift duration
    IF shift_duration >= '8 hours'::INTERVAL THEN
        -- 8+ hour shift: Morning, Lunch, Afternoon breaks
        -- FIXED: Morning break is now 9:00 AM - 10:00 AM
        RETURN QUERY VALUES 
            ('Morning'::break_type_enum, '09:00:00'::TIME, '10:00:00'::TIME),
            ('Lunch'::break_type_enum, '11:00:00'::TIME, '14:00:00'::TIME),
            ('Afternoon'::break_type_enum, '14:45:00'::TIME, '15:45:00'::TIME);
    ELSIF shift_duration >= '6 hours'::INTERVAL THEN
        -- 6-8 hour shift: Morning and Lunch breaks
        RETURN QUERY VALUES 
            ('Morning'::break_type_enum, '09:00:00'::TIME, '10:00:00'::TIME),
            ('Lunch'::break_type_enum, '11:00:00'::TIME, '14:00:00'::TIME);
    ELSIF shift_duration >= '4 hours'::INTERVAL THEN
        -- 4-6 hour shift: Just one break (Morning)
        RETURN QUERY VALUES 
            ('Morning'::break_type_enum, '09:00:00'::TIME, '10:00:00'::TIME);
    END IF;

    RETURN;
END;
$$;

-- Also fix the is_break_reminder_due function to work better with different break types
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

    -- Check for recent notifications to avoid spam (reduce from 25 to 20 minutes)
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
    -- This triggers at 30-minute intervals: 30min, 60min, etc.
    -- Simplified logic: just check if we're around the 30-minute mark
    RETURN (minutes_since_start >= 28 AND minutes_since_start <= 32);
END;
$$;
