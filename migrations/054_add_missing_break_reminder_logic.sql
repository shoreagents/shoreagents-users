-- Migration: Add missing "missed break" reminder logic to check_break_reminders
-- This will fix the missing "You have not taken your Afternoon break yet!" notifications

-- Drop and recreate the check_break_reminders function to include missed break logic
DROP FUNCTION IF EXISTS public.check_break_reminders();

CREATE OR REPLACE FUNCTION public.check_break_reminders()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
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
        
        -- NEW: Check for missed breaks (30 minutes after break becomes available)
        -- This will send "You have not taken your [Break] yet!" notifications
        IF is_break_missed(agent_record.user_id, 'Morning', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Morning');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        IF is_break_missed(agent_record.user_id, 'Lunch', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Lunch');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        IF is_break_missed(agent_record.user_id, 'Afternoon', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Afternoon');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        -- Check for night shift missed breaks
        IF is_break_missed(agent_record.user_id, 'NightFirst', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightFirst');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        IF is_break_missed(agent_record.user_id, 'NightMeal', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightMeal');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        IF is_break_missed(agent_record.user_id, 'NightSecond', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightSecond');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        -- FIXED: Add break window ending soon checks (15 minutes before break window expires)
        -- This prevents generic "Break ending soon" notifications
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
        
        -- Check for night shift break windows ending soon
        IF is_break_window_ending_soon(agent_record.user_id, 'NightFirst', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'NightFirst');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        IF is_break_window_ending_soon(agent_record.user_id, 'NightMeal', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'NightMeal');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        IF is_break_window_ending_soon(agent_record.user_id, 'NightSecond', check_time) THEN
            PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'NightSecond');
            notifications_sent := notifications_sent + 1;
        END IF;
        
        -- REMOVED: Active break ending soon check to prevent duplicate notifications
        -- We only need break window ending soon notifications (15 minutes before window expires)
        -- The is_break_window_ending_soon function already handles this correctly
    END LOOP;
    
    RETURN notifications_sent;
END;
$function$;

COMMENT ON FUNCTION public.check_break_reminders() IS 'FIXED: Now includes missing "missed break" reminder logic for all break types. This will send "You have not taken your [Break] yet!" notifications 30 minutes after break becomes available.';
