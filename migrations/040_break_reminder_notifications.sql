-- Migration: Break Reminder Notifications System
-- This migration adds functions to check for break availability and send reminder notifications

-- Function to get agent shift information for break timing
CREATE OR REPLACE FUNCTION get_agent_shift_info(p_agent_user_id INTEGER)
RETURNS TABLE(
    user_id INTEGER,
    shift_time TEXT,
    shift_period TEXT,
    shift_schedule TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as user_id,
        COALESCE(ji.shift_time, '6:00 AM - 3:00 PM') as shift_time,
        COALESCE(ji.shift_period, 'Day Shift') as shift_period,
        COALESCE(ji.shift_schedule, 'Monday-Friday') as shift_schedule
    FROM users u
    LEFT JOIN agents a ON u.id = a.user_id
    LEFT JOIN job_info ji ON ji.agent_user_id = a.user_id
    WHERE u.id = p_agent_user_id;
END;
$$;

-- Function to parse shift time and calculate break windows dynamically
CREATE OR REPLACE FUNCTION calculate_break_windows(p_shift_time TEXT)
RETURNS TABLE(
    morning_start TIME,
    morning_end TIME,
    lunch_start TIME,
    lunch_end TIME,
    afternoon_start TIME,
    afternoon_end TIME
)
LANGUAGE plpgsql
AS $$
DECLARE
    shift_parts TEXT[];
    start_time_str TEXT;
    end_time_str TEXT;
    start_time TIME;
    end_time TIME;
    shift_duration_minutes INTEGER;
    is_night_shift BOOLEAN;
    morning_break_start TIME;
    morning_break_end TIME;
    lunch_break_start TIME;
    lunch_break_end TIME;
    afternoon_break_start TIME;
    afternoon_break_end TIME;
BEGIN
    -- Parse shift time (e.g., "6:00 AM - 3:00 PM")
    shift_parts := string_to_array(p_shift_time, ' - ');
    
    IF array_length(shift_parts, 1) != 2 THEN
        -- Default to day shift if parsing fails
        start_time := '06:00'::TIME;
        end_time := '15:00'::TIME;
    ELSE
        start_time_str := trim(shift_parts[1]);
        end_time_str := trim(shift_parts[2]);
        
        -- Convert to 24-hour format
        start_time := CASE 
            WHEN start_time_str LIKE '%PM' AND NOT start_time_str LIKE '12:%PM' THEN
                (split_part(start_time_str, ' ', 1)::TIME + INTERVAL '12 hours')::TIME
            WHEN start_time_str LIKE '12:%AM' THEN
                (replace(start_time_str, '12:', '00:')::TIME)
            ELSE
                split_part(start_time_str, ' ', 1)::TIME
        END;
        
        end_time := CASE 
            WHEN end_time_str LIKE '%PM' AND NOT end_time_str LIKE '12:%PM' THEN
                (split_part(end_time_str, ' ', 1)::TIME + INTERVAL '12 hours')::TIME
            WHEN end_time_str LIKE '12:%AM' THEN
                (replace(end_time_str, '12:', '00:')::TIME)
            ELSE
                split_part(end_time_str, ' ', 1)::TIME
        END;
    END IF;
    
    -- Determine if it's a night shift
    is_night_shift := start_time > end_time;
    
    -- Calculate shift duration in minutes
    IF is_night_shift THEN
        shift_duration_minutes := EXTRACT(EPOCH FROM (end_time + INTERVAL '24 hours' - start_time)) / 60;
    ELSE
        shift_duration_minutes := EXTRACT(EPOCH FROM (end_time - start_time)) / 60;
    END IF;
    
    -- Calculate break windows dynamically based on shift duration and start time
    -- Morning break: 2 hours after shift start, lasts 2 hours
    morning_break_start := start_time + INTERVAL '2 hours';
    morning_break_end := start_time + INTERVAL '4 hours';
    
    -- Lunch break: at the midpoint of the shift, lasts 1 hour
    IF is_night_shift THEN
        lunch_break_start := start_time + (shift_duration_minutes / 2) * INTERVAL '1 minute';
        lunch_break_end := lunch_break_start + INTERVAL '1 hour';
    ELSE
        lunch_break_start := start_time + (shift_duration_minutes / 2) * INTERVAL '1 minute';
        lunch_break_end := lunch_break_start + INTERVAL '1 hour';
    END IF;
    
    -- Afternoon break: 2 hours before shift end, lasts until shift end
    IF is_night_shift THEN
        afternoon_break_start := (start_time + shift_duration_minutes * INTERVAL '1 minute') - INTERVAL '2 hours';
        afternoon_break_end := start_time + shift_duration_minutes * INTERVAL '1 minute';
    ELSE
        afternoon_break_start := end_time - INTERVAL '2 hours';
        afternoon_break_end := end_time;
    END IF;
    
    -- Handle time wrapping for night shifts
    IF is_night_shift THEN
        -- Adjust times that go past midnight
        IF morning_break_start >= '24:00:00'::TIME THEN
            morning_break_start := morning_break_start - INTERVAL '24 hours';
        END IF;
        IF morning_break_end >= '24:00:00'::TIME THEN
            morning_break_end := morning_break_end - INTERVAL '24 hours';
        END IF;
        IF lunch_break_start >= '24:00:00'::TIME THEN
            lunch_break_start := lunch_break_start - INTERVAL '24 hours';
        END IF;
        IF lunch_break_end >= '24:00:00'::TIME THEN
            lunch_break_end := lunch_break_end - INTERVAL '24 hours';
        END IF;
        IF afternoon_break_start >= '24:00:00'::TIME THEN
            afternoon_break_start := afternoon_break_start - INTERVAL '24 hours';
        END IF;
        IF afternoon_break_end >= '24:00:00'::TIME THEN
            afternoon_break_end := afternoon_break_end - INTERVAL '24 hours';
        END IF;
    END IF;
    
    RETURN QUERY SELECT
        morning_break_start as morning_start,
        morning_break_end as morning_end,
        lunch_break_start as lunch_start,
        lunch_break_end as lunch_end,
        afternoon_break_start as afternoon_start,
        afternoon_break_end as afternoon_end;
END;
$$;

-- Function to check if a break is available soon (within next 15 minutes)
CREATE OR REPLACE FUNCTION is_break_available_soon(
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
    minutes_until_break INTEGER;
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
    
    -- Determine break start time based on break type
    break_start_time := CASE p_break_type
        WHEN 'Morning' THEN break_windows.morning_start
        WHEN 'Lunch' THEN break_windows.lunch_start
        WHEN 'Afternoon' THEN break_windows.afternoon_start
        WHEN 'NightFirst' THEN break_windows.morning_start
        WHEN 'NightMeal' THEN break_windows.lunch_start
        WHEN 'NightSecond' THEN break_windows.afternoon_start
        ELSE NULL
    END;
    
    IF break_start_time IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate minutes until break starts
    minutes_until_break := EXTRACT(EPOCH FROM (break_start_time - current_time_only)) / 60;
    
    -- Handle day rollover for night shifts
    IF minutes_until_break < -720 THEN -- More than 12 hours in the past
        minutes_until_break := minutes_until_break + 1440; -- Add 24 hours
    END IF;
    
    -- Return true if break starts within the next 15 minutes
    RETURN minutes_until_break > 0 AND minutes_until_break <= 15;
END;
$$;

-- Function to check if a break is ending soon (within next 5 minutes)
CREATE OR REPLACE FUNCTION is_break_ending_soon(
    p_agent_user_id INTEGER,
    p_current_time TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    active_break RECORD;
    break_duration_minutes INTEGER;
    elapsed_minutes INTEGER;
    remaining_minutes INTEGER;
BEGIN
    -- Get current active break
    SELECT * INTO active_break
    FROM break_sessions
    WHERE agent_user_id = p_agent_user_id
    AND end_time IS NULL
    AND break_date = p_current_time::DATE
    ORDER BY start_time DESC
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Get break duration based on type
    break_duration_minutes := CASE active_break.break_type
        WHEN 'Morning' THEN 15
        WHEN 'Lunch' THEN 60
        WHEN 'Afternoon' THEN 15
        WHEN 'NightFirst' THEN 15
        WHEN 'NightMeal' THEN 60
        WHEN 'NightSecond' THEN 15
        ELSE 15
    END;
    
    -- Calculate elapsed time
    elapsed_minutes := EXTRACT(EPOCH FROM (p_current_time - active_break.start_time)) / 60;
    
    -- Handle paused breaks
    IF active_break.pause_time IS NOT NULL AND active_break.resume_time IS NULL THEN
        -- Break is currently paused, use time_remaining_at_pause
        remaining_minutes := COALESCE(active_break.time_remaining_at_pause, 0) / 60;
    ELSE
        -- Calculate remaining time
        remaining_minutes := break_duration_minutes - elapsed_minutes;
        
        -- Adjust for pause time if break was paused and resumed
        IF active_break.pause_time IS NOT NULL AND active_break.resume_time IS NOT NULL THEN
            remaining_minutes := remaining_minutes + EXTRACT(EPOCH FROM (active_break.resume_time - active_break.pause_time)) / 60;
        END IF;
    END IF;
    
    -- Return true if break ends within the next 5 minutes
    RETURN remaining_minutes > 0 AND remaining_minutes <= 5;
END;
$$;

-- Function to create break reminder notifications
CREATE OR REPLACE FUNCTION create_break_reminder_notification(
    p_agent_user_id INTEGER,
    p_notification_type TEXT, -- 'available_soon', 'ending_soon'
    p_break_type break_type_enum DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    title_text TEXT;
    message_text TEXT;
    notif_category TEXT := 'break';
    notif_type TEXT := 'info';
    payload_data JSONB;
BEGIN
    IF p_notification_type = 'available_soon' AND p_break_type IS NOT NULL THEN
        title_text := format('%s break available soon', p_break_type);
        message_text := format('Your %s break will be available in 15 minutes', p_break_type);
        notif_type := 'info';
        payload_data := jsonb_build_object(
            'break_type', p_break_type,
            'reminder_type', 'available_soon',
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

-- Function to check all agents for break reminders
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
        
        -- Check for night shift breaks
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
COMMENT ON FUNCTION get_agent_shift_info(INTEGER) IS 'Gets agent shift information from job_info table with fallback defaults';
COMMENT ON FUNCTION calculate_break_windows(TEXT) IS 'Calculates break time windows based on agent shift time';
COMMENT ON FUNCTION is_break_available_soon(INTEGER, break_type_enum, TIMESTAMP) IS 'Checks if a break will be available within the next 15 minutes';
COMMENT ON FUNCTION is_break_ending_soon(INTEGER, TIMESTAMP) IS 'Checks if current break will end within the next 5 minutes';
COMMENT ON FUNCTION create_break_reminder_notification(INTEGER, TEXT, break_type_enum) IS 'Creates break reminder notifications with duplicate prevention';
COMMENT ON FUNCTION check_break_reminders() IS 'Checks all agents for break reminders and sends notifications';
