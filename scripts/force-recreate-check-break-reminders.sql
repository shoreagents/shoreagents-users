-- Force recreate check_break_reminders function with a different approach
-- First, drop it completely
DROP FUNCTION IF EXISTS check_break_reminders() CASCADE;

-- Now recreate it with explicit type handling
CREATE FUNCTION check_break_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    agent_record RECORD;
    notifications_sent INTEGER := 0;
    break_windows RECORD;
    should_send_notification BOOLEAN;
    agent_id INTEGER;
BEGIN
    FOR agent_record IN
        SELECT DISTINCT u.id as user_id
        FROM users u
        INNER JOIN agents a ON u.id = a.user_id
        WHERE u.user_type = 'Agent'
    LOOP
        -- Explicitly cast to INTEGER to ensure type safety
        agent_id := agent_record.user_id::INTEGER;
        
        -- Get break windows for this agent
        FOR break_windows IN
            SELECT * FROM calculate_break_windows(agent_id)
        LOOP
            -- Check if notification is needed for this break type
            should_send_notification := FALSE;
            
            -- Available soon (15 min before start)
            IF is_break_available_soon(agent_id, break_windows.break_type) THEN
                should_send_notification := TRUE;
            END IF;
            
            -- Available now (exact start time)
            IF is_break_available_now(agent_id, break_windows.break_type) THEN
                should_send_notification := TRUE;
            END IF;
            
            -- Reminder due (every 30 min during break window)
            IF is_break_reminder_due(agent_id, break_windows.break_type) THEN
                should_send_notification := TRUE;
            END IF;
            
            -- Ending soon (15 min before end)
            IF is_break_window_ending_soon(agent_id, break_windows.break_type) THEN
                should_send_notification := TRUE;
            END IF;
            
            -- Send notification if needed
            IF should_send_notification THEN
                PERFORM create_break_reminder_notification(
                    agent_id,
                    CASE 
                        WHEN is_break_available_soon(agent_id, break_windows.break_type) THEN 'available_soon'
                        WHEN is_break_available_now(agent_id, break_windows.break_type) THEN 'break_available'
                        WHEN is_break_reminder_due(agent_id, break_windows.break_type) THEN 'missed_break'
                        WHEN is_break_window_ending_soon(agent_id, break_windows.break_type) THEN 'ending_soon'
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

COMMENT ON FUNCTION check_break_reminders() IS 'Main function to check and send break reminders (with explicit type casting)';
