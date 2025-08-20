-- Fix check_break_reminders function to provide correct parameters to other functions
DROP FUNCTION IF EXISTS check_break_reminders() CASCADE;

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
    current_ts TIMESTAMP;
BEGIN
    -- Get current timestamp for Manila timezone
    current_ts := NOW() AT TIME ZONE 'Asia/Manila';
    
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
            
            -- Available soon (15 min before start) - provide timestamp parameter
            IF is_break_available_soon(agent_id, break_windows.break_type, current_ts) THEN
                should_send_notification := TRUE;
            END IF;
            
            -- Available now (exact start time) - provide timestamp parameter
            IF is_break_available_now(agent_id, break_windows.break_type, current_ts) THEN
                should_send_notification := TRUE;
            END IF;
            
            -- Reminder due (every 30 min during break window) - this one only needs 2 params
            IF is_break_reminder_due(agent_id, break_windows.break_type) THEN
                should_send_notification := TRUE;
            END IF;
            
            -- Ending soon (15 min before end) - provide timestamp parameter
            IF is_break_window_ending_soon(agent_id, break_windows.break_type, current_ts) THEN
                should_send_notification := TRUE;
            END IF;
            
            -- Send notification if needed
            IF should_send_notification THEN
                PERFORM create_break_reminder_notification(
                    agent_id,
                    CASE 
                        WHEN is_break_available_soon(agent_id, break_windows.break_type, current_ts) THEN 'available_soon'
                        WHEN is_break_available_now(agent_id, break_windows.break_type, current_ts) THEN 'break_available'
                        WHEN is_break_reminder_due(agent_id, break_windows.break_type) THEN 'missed_break'
                        WHEN is_break_window_ending_soon(agent_id, break_windows.break_type, current_ts) THEN 'ending_soon'
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

COMMENT ON FUNCTION check_break_reminders() IS 'Main function to check and send break reminders (with correct function parameters)';
