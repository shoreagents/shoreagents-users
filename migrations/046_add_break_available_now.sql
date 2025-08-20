-- Migration: 046_add_break_available_now.sql
-- Description: Add "break is now available" notification functionality
-- Date: 2025-01-20

-- Function to check if a break is currently available/active
CREATE OR REPLACE FUNCTION is_break_available_now(
    p_agent_user_id INTEGER,
    p_break_type break_type_enum,
    p_current_time TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
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
    minutes_until_end INTEGER;
    break_already_taken BOOLEAN;
BEGIN
    -- Get agent shift information
    SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check if break was already taken today
    SELECT EXISTS(
        SELECT 1 FROM break_sessions 
        WHERE agent_user_id = p_agent_user_id 
        AND break_type = p_break_type 
        AND break_date = p_current_time::DATE
    ) INTO break_already_taken;
    
    IF break_already_taken THEN
        RETURN FALSE;
    END IF;
    
    -- Get break windows for this shift
    SELECT * INTO break_windows FROM calculate_break_windows(shift_info.shift_time) LIMIT 1;
    
    current_time_only := p_current_time::TIME;
    
    -- Determine break start and end times based on break type
    CASE p_break_type
        WHEN 'Morning' THEN
            break_start_time := break_windows.morning_start;
            break_end_time := break_windows.morning_end;
        WHEN 'Lunch' THEN
            break_start_time := break_windows.lunch_start;
            break_end_time := break_windows.lunch_end;
        WHEN 'Afternoon' THEN
            break_start_time := break_windows.afternoon_start;
            break_end_time := break_windows.afternoon_end;
        WHEN 'NightFirst' THEN
            break_start_time := break_windows.morning_start;
            break_end_time := break_windows.morning_end;
        WHEN 'NightMeal' THEN
            break_start_time := break_windows.lunch_start;
            break_end_time := break_windows.lunch_end;
        WHEN 'NightSecond' THEN
            break_start_time := break_windows.afternoon_start;
            break_end_time := break_windows.afternoon_end;
        ELSE
            RETURN FALSE;
    END CASE;
    
    IF break_start_time IS NULL OR break_end_time IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Handle day rollover for night shifts
    IF break_start_time > break_end_time THEN
        -- Night shift break crosses midnight
        IF current_time_only >= break_start_time OR current_time_only < break_end_time THEN
            -- Current time is within the break window
            RETURN TRUE;
        END IF;
    ELSE
        -- Day shift break within same day
        IF current_time_only >= break_start_time AND current_time_only < break_end_time THEN
            -- Current time is within the break window
            RETURN TRUE;
        END IF;
    END IF;
    
    RETURN FALSE;
END;
$$;

-- Update the check_break_reminders function to include "available now" notifications
CREATE OR REPLACE FUNCTION check_break_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    agent_record RECORD;
    notifications_sent INTEGER := 0;
    check_time TIMESTAMP;
BEGIN
    check_time := NOW() AT TIME ZONE 'Asia/Manila';
    
    -- Loop through all active agents
    FOR agent_record IN 
        SELECT DISTINCT u.id as user_id
        FROM users u
        INNER JOIN agents a ON u.id = a.user_id
        WHERE u.user_type = 'Agent'
    LOOP
        -- Check for breaks available soon (15 minutes before)
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
        
        -- Check for night shift breaks available soon
        IF is_break_available_soon(agent_record.user_id, 'NightFirst', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightFirst');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        IF is_break_available_soon(agent_record.user_id, 'NightMeal', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightMeal');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        IF is_break_available_soon(agent_record.user_id, 'NightSecond', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightSecond');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        -- Check for breaks that are currently available/active
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
        
        -- Check for night shift breaks currently available
        IF is_break_available_now(agent_record.user_id, 'NightFirst', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightFirst');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        IF is_break_available_now(agent_record.user_id, 'NightMeal', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightMeal');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        IF is_break_available_now(agent_record.user_id, 'NightSecond', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightSecond');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        -- Check for breaks ending soon
        IF is_break_ending_soon(agent_record.user_id, check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon');
            notifications_sent := notifications_sent + 1;
        END IF;
    END LOOP;
    
    RETURN notifications_sent;
END;
$$;

-- Update the create_break_reminder_notification function to handle 'available_now' type
CREATE OR REPLACE FUNCTION create_break_reminder_notification(
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
BEGIN
    -- Determine break name for display
    break_name := CASE p_break_type
        WHEN 'Morning' THEN 'Morning break'
        WHEN 'Lunch' THEN 'Lunch break'
        WHEN 'Afternoon' THEN 'Afternoon break'
        WHEN 'NightFirst' THEN 'First night break'
        WHEN 'NightMeal' THEN 'Night meal break'
        WHEN 'NightSecond' THEN 'Second night break'
        ELSE 'Break'
    END;
    
    -- Set notification content based on type
    IF p_notification_type = 'available_soon' THEN
        title_text := 'Break available soon';
        message_text := format('Your %s will be available in 15 minutes', break_name);
        notif_type := 'info';
        payload_data := jsonb_build_object(
            'reminder_type', 'available_soon',
            'break_type', p_break_type,
            'action_url', '/status/breaks'
        );
    ELSIF p_notification_type = 'available_now' THEN
        title_text := 'Break is now available';
        message_text := format('Your %s is now available! You can take it now.', break_name);
        notif_type := 'success';
        payload_data := jsonb_build_object(
            'reminder_type', 'available_now',
            'break_type', p_break_type,
            'action_url', '/status/breaks'
        );
    ELSIF p_notification_type = 'ending_soon' THEN
        title_text := 'Break ending soon';
        message_text := 'Your current break will end in 15 minutes';
        notif_type := 'warning';
        payload_data := jsonb_build_object(
            'reminder_type', 'ending_soon',
            'action_url', '/status/breaks'
        );
    ELSE
        RETURN; -- Invalid notification type
    END IF;
    
    -- Check if similar notification already exists in the last 30 minutes
    IF EXISTS(
        SELECT 1 FROM notifications 
        WHERE user_id = p_agent_user_id 
        AND category = notif_category
        AND title = title_text
        AND created_at > (NOW() - INTERVAL '30 minutes')
    ) THEN
        RETURN; -- Don't create duplicate notifications
    END IF;
    
    -- Insert the notification
    INSERT INTO notifications (user_id, category, type, title, message, payload)
    VALUES (p_agent_user_id, notif_category, notif_type, title_text, message_text, payload_data);
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION is_break_available_now(INTEGER, break_type_enum, TIMESTAMP) IS 'Checks if a break is currently available/active';
COMMENT ON FUNCTION check_break_reminders() IS 'Updated: Now includes available-soon, available-now, and ending-soon notifications';
COMMENT ON FUNCTION create_break_reminder_notification(INTEGER, TEXT, break_type_enum) IS 'Updated: Now handles available_now notification type';
