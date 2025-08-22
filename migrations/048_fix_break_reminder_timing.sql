-- Migration 048: Fix break reminder timing to send "missed break" notifications every 30 minutes
-- Problem: The system only sent "missed break" notifications once at 30 minutes, not every 30 minutes
-- Root cause: is_break_reminder_due function had narrow 28-32 minute window instead of every 30 minutes

-- Fix the is_break_reminder_due function to send reminders every 30 minutes
CREATE OR REPLACE FUNCTION is_break_reminder_due(
    p_agent_user_id INTEGER, 
    p_break_type break_type_enum, 
    p_check_time TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    shift_time TEXT;
    break_windows RECORD;
    current_time_only TIME;
    break_start_time TIME;
    break_end_time TIME;
    minutes_since_start INTEGER;
    break_already_taken BOOLEAN;
    last_notification_time TIMESTAMP;
    minutes_since_last_notification INTEGER;
BEGIN
    -- Get agent shift information directly from job_info
    SELECT ji.shift_time INTO shift_time 
    FROM job_info ji
    WHERE ji.agent_user_id = p_agent_user_id 
    LIMIT 1;
    
    IF NOT FOUND OR shift_time IS NULL THEN
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
    -- Convert both times to Asia/Manila timezone for consistent comparison
    SELECT MAX(created_at) INTO last_notification_time
    FROM notifications
    WHERE user_id = p_agent_user_id
    AND category = 'break'
    AND payload->>'reminder_type' = 'missed_break'
    AND payload->>'break_type' = p_break_type::text
    AND (created_at AT TIME ZONE 'UTC') < (p_check_time AT TIME ZONE 'Asia/Manila')
    AND DATE(created_at AT TIME ZONE 'Asia/Manila') = CURRENT_DATE;

    -- Calculate minutes since last notification
    IF last_notification_time IS NOT NULL THEN
        minutes_since_last_notification := EXTRACT(EPOCH FROM (p_check_time - last_notification_time)) / 60;
    ELSE
        minutes_since_last_notification := 999; -- No previous notification
    END IF;

    -- Send reminder every 30 minutes after break starts, but not more frequently than every 20 minutes
    -- First reminder at 30 minutes, then every 30 minutes after that
    IF minutes_since_start < 30 THEN
        RETURN FALSE; -- Too early for first reminder
    END IF;

    -- Check if enough time has passed since last notification (minimum 25 minutes)
    -- This ensures we can send reminders every 30 minutes
    IF minutes_since_last_notification < 25 THEN
        RETURN FALSE; -- Too soon since last notification
    END IF;

    -- Check if we're at a 30-minute interval (with 5-minute tolerance)
    -- This allows for slight timing variations in the scheduler
    RETURN (minutes_since_start % 30) <= 5 OR (minutes_since_start % 30) >= 25;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION is_break_reminder_due(INTEGER, break_type_enum, TIMESTAMP WITHOUT TIME ZONE) IS 'Fixed: Now sends missed break reminders every 30 minutes instead of just once';
