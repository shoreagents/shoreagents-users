-- Fix notification spam and timing issues

-- 1. Fix is_break_available_now function - it's incorrectly detecting times outside the window
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

    -- DEBUG: Log the comparison
    RAISE NOTICE 'Available Now Check - Current: %, Start: %, End: %, Within window: %', 
        current_time_only, break_start_time, break_end_time, 
        (current_time_only >= break_start_time AND current_time_only <= break_end_time);

    -- Return true ONLY if current time is within the break window
    RETURN (current_time_only >= break_start_time AND current_time_only <= break_end_time);
END;
$$;

-- 2. Fix check_break_reminders to prevent notification spam
CREATE OR REPLACE FUNCTION check_break_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    agent_record RECORD;
    notifications_sent INTEGER := 0;
    check_time TIMESTAMP WITHOUT TIME ZONE;
    last_notification_time TIMESTAMP;
    minutes_since_last_notification INTEGER;
BEGIN
    check_time := NOW();
    
    -- Loop through all agents
    FOR agent_record IN 
        SELECT DISTINCT u.id as user_id, u.email
        FROM users u
        WHERE u.user_type = 'Agent'
    LOOP
        -- Check for recent notifications to prevent spam
        SELECT MAX(created_at) INTO last_notification_time
        FROM notifications
        WHERE user_id = agent_record.user_id
        AND category = 'break'
        AND created_at > CURRENT_DATE;

        -- If there was a recent notification, check if enough time has passed
        IF last_notification_time IS NOT NULL THEN
            minutes_since_last_notification := EXTRACT(EPOCH FROM (check_time - last_notification_time)) / 60;
            
            -- Skip this agent if a notification was sent within the last 5 minutes
            IF minutes_since_last_notification < 5 THEN
                CONTINUE;
            END IF;
        END IF;

        -- Available soon (15 min before start)
        IF is_break_available_soon(agent_record.user_id, 'Morning', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Morning');
            notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_available_soon(agent_record.user_id, 'Lunch', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Lunch');
            notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_available_soon(agent_record.user_id, 'Afternoon', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Afternoon');
            notifications_sent := notifications_sent + 1;
        END IF;

        -- Available now (at start)
        IF is_break_available_now(agent_record.user_id, 'Morning', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Morning');
            notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_available_now(agent_record.user_id, 'Lunch', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Lunch');
            notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_available_now(agent_record.user_id, 'Afternoon', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Afternoon');
            notifications_sent := notifications_sent + 1;
        END IF;

        -- Reminder due (30 min after start)
        IF is_break_reminder_due(agent_record.user_id, 'Morning', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'reminder', 'Morning');
            notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_reminder_due(agent_record.user_id, 'Lunch', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'reminder', 'Lunch');
            notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_reminder_due(agent_record.user_id, 'Afternoon', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'reminder', 'Afternoon');
            notifications_sent := notifications_sent + 1;
        END IF;

        -- Ending soon (15 min before end)
        IF is_break_window_ending_soon(agent_record.user_id, 'Morning', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Morning');
            notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_window_ending_soon(agent_record.user_id, 'Lunch', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Lunch');
            notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_window_ending_soon(agent_record.user_id, 'Afternoon', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Afternoon');
            notifications_sent := notifications_sent + 1;
        END IF;
    END LOOP;

    RETURN notifications_sent;
END;
$$;
