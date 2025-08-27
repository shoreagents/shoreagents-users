-- Comprehensive Activity Reset Function
-- This function handles both shift start detection AND cleanup of shifts that should have been reset
-- It's designed to fix situations where the system missed the reset window

CREATE OR REPLACE FUNCTION public.comprehensive_activity_reset(
    p_check_time TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    rec RECORD;
    reset_count INTEGER := 0;
    current_date DATE := p_check_time::date;
    current_time_minutes INTEGER := EXTRACT(HOUR FROM p_check_time) * 60 + EXTRACT(MINUTE FROM p_check_time);
    shift_start_minutes INTEGER;
    shift_end_minutes INTEGER;
    shift_text TEXT;
    is_night_shift BOOLEAN;
    shift_start_time TIMESTAMP WITHOUT TIME ZONE;
    time_diff_seconds INTEGER;
    activity_row RECORD;
    agent_name TEXT;
    should_reset BOOLEAN;
BEGIN
    -- Loop through all agents with their shift information
    FOR rec IN (
        SELECT 
            u.id AS user_id,
            u.email,
            COALESCE(pi.first_name || ' ' || pi.last_name, u.email) AS agent_name,
            ji.shift_time,
            ji.employee_id
        FROM users u
        JOIN agents a ON a.user_id = u.id
        LEFT JOIN job_info ji ON ji.agent_user_id = u.id
        LEFT JOIN personal_info pi ON pi.user_id = u.id
        WHERE u.user_type = 'Agent'
    ) LOOP
        -- Skip if no shift time configured
        IF rec.shift_time IS NULL OR rec.shift_time = '' THEN
            CONTINUE;
        END IF;

        shift_text := rec.shift_time;
        agent_name := rec.agent_name;
        should_reset := FALSE;
        
        -- Parse shift time format like "6:00 AM - 3:00 PM"
        IF shift_text ~* '(\d{1,2}:\d{2}\s*(AM|PM)).*-(.*\d{1,2}:\d{2}\s*(AM|PM))' THEN
            -- Extract start time (first time in the range)
            shift_start_minutes := (
                CASE UPPER(split_part(split_part(shift_text, '-', 1), ' ', 2))
                    WHEN 'AM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 1), ':', 1)::INT % 12 = 0 THEN 0 ELSE split_part(split_part(shift_text, '-', 1), ':', 1)::INT END) * 60 + split_part(split_part(split_part(shift_text, '-', 1), ' ', 1), ':', 2)::INT
                    WHEN 'PM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 1), ':', 1)::INT = 12 THEN 12 ELSE split_part(split_part(shift_text, '-', 1), ':', 1)::INT + 12 END) * 60 + split_part(split_part(split_part(shift_text, '-', 1), ' ', 1), ':', 2)::INT
                END
            );
            
            -- Extract end time (second time in the range)
            shift_end_minutes := (
                CASE UPPER(split_part(split_part(shift_text, '-', 2), ' ', 2))
                    WHEN 'AM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 2), ':', 1)::INT % 12 = 0 THEN 0 ELSE split_part(split_part(shift_text, '-', 2), ':', 1)::INT END) * 60 + split_part(split_part(split_part(shift_text, '-', 2), ' ', 1), ':', 2)::INT
                    WHEN 'PM' THEN (CASE WHEN split_part(split_part(shift_text, '-', 2), ':', 1)::INT = 12 THEN 12 ELSE split_part(split_part(shift_text, '-', 2), ':', 1)::INT + 12 END) * 60 + split_part(split_part(split_part(shift_text, '-', 2), ' ', 1), ':', 2)::INT
                END
            );
        ELSE
            -- Skip if cannot parse shift time
            CONTINUE;
        END IF;

        -- Determine if this is a night shift (spans midnight)
        is_night_shift := shift_end_minutes < shift_start_minutes;
        
        -- Calculate the shift start time for today
        shift_start_time := current_date + (shift_start_minutes || ' minutes')::INTERVAL;
        
        -- For night shifts, if current time is before shift start, the shift started yesterday
        IF is_night_shift AND current_time_minutes < shift_start_minutes THEN
            shift_start_time := (current_date - INTERVAL '1 day') + (shift_start_minutes || ' minutes')::INTERVAL;
        END IF;
        
        -- Check if we're within 10 minutes of the shift start time
        time_diff_seconds := ABS(EXTRACT(EPOCH FROM (p_check_time - shift_start_time)));
        
        -- SCENARIO 1: We're near shift start time (within 10 minutes)
        IF time_diff_seconds <= 600 THEN
            should_reset := TRUE;
            RAISE NOTICE 'Scenario 1: Near shift start time for user % (within 10 minutes)', agent_name;
        END IF;
        
        -- SCENARIO 2: We're past shift start time but activity data is from previous day
        -- This handles cases where the system missed the reset window
        IF time_diff_seconds > 600 AND time_diff_seconds <= 3600 THEN -- Between 10 minutes and 1 hour past shift start
            -- Check if we have an activity row for today
            SELECT * INTO activity_row 
            FROM activity_data 
            WHERE user_id = rec.user_id 
            AND today_date = current_date::text;
            
            IF FOUND THEN
                -- Check if the activity data has accumulated significant time (more than 1 hour)
                -- This indicates it wasn't properly reset at shift start
                IF activity_row.today_active_seconds > 3600 OR activity_row.today_inactive_seconds > 3600 THEN
                    should_reset := TRUE;
                    RAISE NOTICE 'Scenario 2: Past shift start with accumulated time for user % (active: %s, inactive: %s)', 
                        agent_name, activity_row.today_active_seconds, activity_row.today_inactive_seconds;
                END IF;
            END IF;
        END IF;
        
        -- Perform the reset if needed
        IF should_reset THEN
            -- Check if we have an activity row for today
            SELECT * INTO activity_row 
            FROM activity_data 
            WHERE user_id = rec.user_id 
            AND today_date = current_date::text;
            
            -- If no activity row exists for today, create one
            IF NOT FOUND THEN
                INSERT INTO activity_data (
                    user_id, 
                    is_currently_active, 
                    last_session_start, 
                    today_date, 
                    today_active_seconds, 
                    today_inactive_seconds, 
                    updated_at
                ) VALUES (
                    rec.user_id, 
                    FALSE, 
                    NULL, 
                    current_date::text, 
                    0, 
                    0, 
                    p_check_time
                );
                
                reset_count := reset_count + 1;
                
                RAISE NOTICE 'Created new activity row for user % (shift starting at %)', agent_name, shift_start_time;
            ELSE
                -- Reset existing activity row to 0 values
                UPDATE activity_data 
                SET 
                    today_active_seconds = 0,
                    today_inactive_seconds = 0,
                    is_currently_active = FALSE,
                    last_session_start = NULL,
                    updated_at = p_check_time
                WHERE user_id = rec.user_id 
                AND today_date = current_date::text;
                
                reset_count := reset_count + 1;
                
                RAISE NOTICE 'Reset activity data for user % (shift starting at %)', agent_name, shift_start_time;
            END IF;
        END IF;
    END LOOP;

    RETURN reset_count;
END;
$$;
