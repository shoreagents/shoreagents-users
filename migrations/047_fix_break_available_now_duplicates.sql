-- Migration 047: Fix break "available_now" notification duplicates
-- Problem: The system was sending "Lunch break is now available" every hour instead of once
-- Root cause: No tracking of whether "available_now" notification was already sent for current break period

-- Add a new function to check if "available_now" notification was already sent for current break period
CREATE OR REPLACE FUNCTION is_break_available_now_notification_sent(
    p_agent_user_id INTEGER,
    p_break_type break_type_enum,
    p_check_time TIMESTAMP
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    break_start_time TIMESTAMP;
    break_end_time TIMESTAMP;
    notification_exists BOOLEAN;
BEGIN
    -- Get the break window for the current day
    SELECT 
        (CURRENT_DATE + (SPLIT_PART(ji.shift_time, ' - ', 1))::time) AT TIME ZONE 'Asia/Manila' INTO break_start_time
    FROM job_info ji 
    WHERE ji.agent_user_id = p_agent_user_id;
    
    IF break_start_time IS NULL THEN
        RETURN FALSE; -- No shift configured
    END IF;
    
    -- Calculate break start time based on break type
    CASE p_break_type
        WHEN 'Lunch' THEN
            break_start_time := break_start_time + INTERVAL '4 hours'; -- 4 hours after shift start
            break_end_time := break_start_time + INTERVAL '1 hour'; -- 1 hour break
        WHEN 'Morning' THEN
            break_start_time := break_start_time + INTERVAL '2 hours'; -- 2 hours after shift start
            break_end_time := break_start_time + INTERVAL '15 minutes'; -- 15 minute break
        WHEN 'Afternoon' THEN
            break_start_time := break_start_time + INTERVAL '6 hours'; -- 6 hours after shift start
            break_end_time := break_start_time + INTERVAL '15 minutes'; -- 15 minute break
        ELSE
            RETURN FALSE; -- Unknown break type
    END CASE;
    
    -- Check if "available_now" notification was already sent for this break period today
    -- We check for notifications sent today, not just within the current break window
    SELECT EXISTS(
        SELECT 1 FROM notifications 
        WHERE user_id = p_agent_user_id 
        AND category = 'break'
        AND payload->>'reminder_type' = 'available_now'
        AND payload->>'break_type' = p_break_type::text
        AND DATE(created_at AT TIME ZONE 'Asia/Manila') = CURRENT_DATE
    ) INTO notification_exists;
    
    RETURN notification_exists;
END;
$$;

-- Update the check_break_reminders function to only send "available_now" once per break period
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
        
        -- Check for breaks that are currently available/active (ONLY if notification not already sent)
        IF is_break_available_now(agent_record.user_id, 'Morning', check_time) 
           AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'Morning', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Morning');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        IF is_break_available_now(agent_record.user_id, 'Lunch', check_time) 
           AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'Lunch', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Lunch');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        IF is_break_available_now(agent_record.user_id, 'Afternoon', check_time) 
           AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'Afternoon', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Afternoon');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        -- Check for night shift breaks currently available (ONLY if notification not already sent)
        IF is_break_available_now(agent_record.user_id, 'NightFirst', check_time) 
           AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'NightFirst', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightFirst');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        IF is_break_available_now(agent_record.user_id, 'NightMeal', check_time) 
           AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'NightMeal', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightMeal');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        IF is_break_available_now(agent_record.user_id, 'NightSecond', check_time) 
           AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'NightSecond', check_time) THEN
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

-- Add comments for documentation
COMMENT ON FUNCTION is_break_available_now_notification_sent(INTEGER, break_type_enum, TIMESTAMP) IS 'Checks if "available_now" notification was already sent for current break period';
COMMENT ON FUNCTION check_break_reminders() IS 'Fixed: Now only sends "available_now" notifications once per break period to prevent duplicates';
