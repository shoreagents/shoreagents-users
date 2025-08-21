-- Fix Break Notification Issues - Version 2
-- This script addresses all the timezone and logic issues

-- Drop existing functions to avoid parameter conflicts
DROP FUNCTION IF EXISTS is_break_available_now(INTEGER, break_type_enum, TIMESTAMP);
DROP FUNCTION IF EXISTS is_break_available_soon(INTEGER, break_type_enum, TIMESTAMP);
DROP FUNCTION IF EXISTS create_break_reminder_notification(INTEGER, TEXT, break_type_enum);
DROP FUNCTION IF EXISTS check_break_reminders();

-- Create fixed is_break_available_now function
CREATE FUNCTION is_break_available_now(
    p_agent_user_id INTEGER,
    p_break_type break_type_enum,
    p_current_time TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    current_time_manila TIMESTAMP;
    current_time_only TIME;
    break_start_time TIME;
    break_end_time TIME;
    break_already_taken BOOLEAN;
    current_hour INTEGER;
BEGIN
    -- Convert current time to Manila timezone consistently
    current_time_manila := p_current_time AT TIME ZONE 'Asia/Manila';
    current_time_only := current_time_manila::TIME;
    current_hour := EXTRACT(HOUR FROM current_time_only);
    
    -- CRITICAL FIX: Add time-of-day validation
    -- Prevent break notifications outside reasonable work hours (6 AM - 6 PM)
    IF current_hour < 6 OR current_hour >= 18 THEN
        RETURN FALSE;
    END IF;
    
    -- Check if break was already taken today
    SELECT EXISTS(
        SELECT 1 FROM break_sessions 
        WHERE agent_user_id = p_agent_user_id 
        AND break_type = p_break_type 
        AND break_date = current_time_manila::DATE
    ) INTO break_already_taken;
    
    IF break_already_taken THEN
        RETURN FALSE;
    END IF;
    
    -- Get break windows - using fixed times for now
    CASE p_break_type
        WHEN 'Morning' THEN
            break_start_time := '08:00:00'::TIME;
            break_end_time := '10:00:00'::TIME;
        WHEN 'Lunch' THEN
            break_start_time := '10:30:00'::TIME;
            break_end_time := '11:30:00'::TIME;
        WHEN 'Afternoon' THEN
            break_start_time := '14:00:00'::TIME;
            break_end_time := '16:00:00'::TIME;
        ELSE
            RETURN FALSE;
    END CASE;
    
    -- CRITICAL FIX: Proper time comparison logic
    -- Simple time comparison within same day for day shifts
    IF current_time_only >= break_start_time AND current_time_only < break_end_time THEN
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;

-- Create fixed is_break_available_soon function
CREATE FUNCTION is_break_available_soon(
    p_agent_user_id INTEGER,
    p_break_type break_type_enum,
    p_current_time TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    current_time_manila TIMESTAMP;
    current_time_only TIME;
    break_start_time TIME;
    minutes_until_break INTEGER;
    break_already_taken BOOLEAN;
    current_hour INTEGER;
BEGIN
    -- Convert current time to Manila timezone consistently
    current_time_manila := p_current_time AT TIME ZONE 'Asia/Manila';
    current_time_only := current_time_manila::TIME;
    current_hour := EXTRACT(HOUR FROM current_time_only);
    
    -- CRITICAL FIX: Add time-of-day validation
    IF current_hour < 6 OR current_hour >= 18 THEN
        RETURN FALSE;
    END IF;
    
    -- Check if break was already taken today
    SELECT EXISTS(
        SELECT 1 FROM break_sessions 
        WHERE agent_user_id = p_agent_user_id 
        AND break_type = p_break_type 
        AND break_date = current_time_manila::DATE
    ) INTO break_already_taken;
    
    IF break_already_taken THEN
        RETURN FALSE;
    END IF;
    
    -- Get break start time
    CASE p_break_type
        WHEN 'Morning' THEN
            break_start_time := '08:00:00'::TIME;
        WHEN 'Lunch' THEN
            break_start_time := '10:30:00'::TIME;
        WHEN 'Afternoon' THEN
            break_start_time := '14:00:00'::TIME;
        ELSE
            RETURN FALSE;
    END CASE;
    
    -- Calculate minutes until break starts
    minutes_until_break := EXTRACT(EPOCH FROM (break_start_time - current_time_only)) / 60;
    
    -- Return true if break starts within the next 15 minutes
    RETURN minutes_until_break > 0 AND minutes_until_break <= 15;
END;
$$;

-- Create fixed create_break_reminder_notification function
CREATE FUNCTION create_break_reminder_notification(
    p_agent_user_id INTEGER,
    p_notification_type TEXT,
    p_break_type break_type_enum DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    notif_category TEXT := 'break';
    notif_type TEXT := 'info';
    title_text TEXT;
    message_text TEXT;
    payload_data JSONB;
    break_name TEXT;
    current_time_manila TIMESTAMP;
    current_hour INTEGER;
BEGIN
    -- Get current Manila time
    current_time_manila := NOW() AT TIME ZONE 'Asia/Manila';
    current_hour := EXTRACT(HOUR FROM current_time_manila);
    
    -- CRITICAL FIX: Add time-of-day validation
    IF current_hour < 6 OR current_hour >= 18 THEN
        RETURN; -- Don't create notifications outside work hours
    END IF;
    
    -- Determine break name for display
    break_name := CASE p_break_type
        WHEN 'Morning' THEN 'Morning break'
        WHEN 'Lunch' THEN 'Lunch break'
        WHEN 'Afternoon' THEN 'Afternoon break'
        ELSE 'Break'
    END;
    
    -- Set notification content based on type
    IF p_notification_type = 'available_soon' THEN
        title_text := format('%s available soon', break_name);
        message_text := format('Your %s will be available in 15 minutes', break_name);
        notif_type := 'info';
        payload_data := jsonb_build_object(
            'reminder_type', 'available_soon',
            'break_type', p_break_type,
            'action_url', '/status/breaks'
        );
    ELSIF p_notification_type = 'available_now' THEN
        title_text := format('%s is now available', break_name);
        message_text := format('Your %s is now available! You can take it now.', break_name);
        notif_type := 'success';
        payload_data := jsonb_build_object(
            'reminder_type', 'available_now',
            'break_type', p_break_type,
            'action_url', '/status/breaks'
        );
    ELSIF p_notification_type = 'ending_soon' THEN
        title_text := 'Break ending soon';
        message_text := 'Your current break will end in 5 minutes';
        notif_type := 'warning';
        payload_data := jsonb_build_object(
            'reminder_type', 'ending_soon',
            'action_url', '/status/breaks'
        );
    ELSE
        RETURN; -- Invalid notification type
    END IF;
    
    -- Check if similar notification already exists in the last 60 minutes
    IF EXISTS(
        SELECT 1 FROM notifications 
        WHERE user_id = p_agent_user_id 
        AND category = notif_category
        AND title = title_text
        AND created_at > (NOW() - INTERVAL '60 minutes')
    ) THEN
        RETURN; -- Don't create duplicate notifications
    END IF;
    
    -- Insert the notification
    INSERT INTO notifications (user_id, category, type, title, message, payload)
    VALUES (p_agent_user_id, notif_category, notif_type, title_text, message_text, payload_data);
END;
$$;

-- Create fixed check_break_reminders function
CREATE FUNCTION check_break_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    agent_record RECORD;
    notifications_sent INTEGER := 0;
    check_time TIMESTAMP;
    current_hour INTEGER;
BEGIN
    -- Use Manila timezone consistently
    check_time := NOW() AT TIME ZONE 'Asia/Manila';
    current_hour := EXTRACT(HOUR FROM check_time);
    
    -- CRITICAL FIX: Only run during work hours (6 AM - 6 PM)
    IF current_hour < 6 OR current_hour >= 18 THEN
        RETURN 0; -- Don't check for reminders outside work hours
    END IF;
    
    -- Loop through all active agents
    FOR agent_record IN 
        SELECT DISTINCT u.id as user_id
        FROM users u
        INNER JOIN agents a ON u.id = a.user_id
        WHERE u.user_type = 'Agent'
    LOOP
        -- Check for breaks available soon
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
        
        -- Check for breaks that are currently available
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
    END LOOP;
    
    RETURN notifications_sent;
END;
$$;

-- Add helpful comments
COMMENT ON FUNCTION is_break_available_now(INTEGER, break_type_enum, TIMESTAMP) IS 'FIXED: Proper timezone handling and work hours validation';
COMMENT ON FUNCTION is_break_available_soon(INTEGER, break_type_enum, TIMESTAMP) IS 'FIXED: Proper timezone handling and work hours validation';
COMMENT ON FUNCTION create_break_reminder_notification(INTEGER, TEXT, break_type_enum) IS 'FIXED: Work hours validation and better duplicate prevention';
COMMENT ON FUNCTION check_break_reminders() IS 'FIXED: Only runs during work hours (6 AM - 6 PM)';

-- Clean up incorrect notifications from the last 2 hours
DELETE FROM notifications 
WHERE category = 'break' 
AND created_at > (NOW() - INTERVAL '2 hours')
AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Manila') NOT BETWEEN 6 AND 17;
