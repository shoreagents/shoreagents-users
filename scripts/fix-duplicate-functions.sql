-- Fix duplicate function issue
-- Drop all instances of the functions first
DROP FUNCTION IF EXISTS is_break_reminder_due(INTEGER, break_type_enum) CASCADE;
DROP FUNCTION IF EXISTS check_break_reminders() CASCADE;

-- Recreate is_break_reminder_due function
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
    IF EXISTS(
        SELECT 1 FROM break_sessions 
        WHERE user_id = p_agent_user_id 
        AND break_type = p_break_type 
        AND DATE(created_at) = CURRENT_DATE
        AND status = 'completed'
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

-- Recreate check_break_reminders function
CREATE FUNCTION check_break_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    agent_record RECORD;
    notifications_sent INTEGER := 0;
    break_windows RECORD;
    should_send_notification BOOLEAN;
BEGIN
    FOR agent_record IN
        SELECT DISTINCT u.id as user_id
        FROM users u
        INNER JOIN agents a ON u.id = a.user_id
        WHERE u.user_type = 'Agent'
    LOOP
        -- Get break windows for this agent
        FOR break_windows IN
            SELECT * FROM calculate_break_windows(agent_record.user_id)
        LOOP
            -- Check if notification is needed for this break type
            should_send_notification := FALSE;
            
            -- Available soon (15 min before start)
            IF is_break_available_soon(agent_record.user_id, break_windows.break_type) THEN
                should_send_notification := TRUE;
            END IF;
            
            -- Available now (exact start time)
            IF is_break_available_now(agent_record.user_id, break_windows.break_type) THEN
                should_send_notification := TRUE;
            END IF;
            
            -- Reminder due (every 30 min during break window)
            IF is_break_reminder_due(agent_record.user_id, break_windows.break_type) THEN
                should_send_notification := TRUE;
            END IF;
            
            -- Ending soon (15 min before end)
            IF is_break_window_ending_soon(agent_record.user_id, break_windows.break_type) THEN
                should_send_notification := TRUE;
            END IF;
            
            -- Send notification if needed
            IF should_send_notification THEN
                PERFORM create_break_reminder_notification(
                    agent_record.user_id,
                    CASE 
                        WHEN is_break_available_soon(agent_record.user_id, break_windows.break_type) THEN 'available_soon'
                        WHEN is_break_available_now(agent_record.user_id, break_windows.break_type) THEN 'break_available'
                        WHEN is_break_reminder_due(agent_record.user_id, break_windows.break_type) THEN 'missed_break'
                        WHEN is_break_window_ending_soon(agent_record.user_id, break_windows.break_type) THEN 'ending_soon'
                        ELSE 'info'
                    END,
                    break_windows.break_type
                );
                notifications_sent := notifications_sent + 1;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN notifications_sent;
END;
$$;

COMMENT ON FUNCTION is_break_reminder_due(INTEGER, break_type_enum) IS 'Checks if break reminder is due (prevents spam)';
COMMENT ON FUNCTION check_break_reminders() IS 'Main function to check and send break reminders (with duplicate prevention)';
