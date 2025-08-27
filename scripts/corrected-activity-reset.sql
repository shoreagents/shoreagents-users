-- Corrected Activity Reset Function
-- This function properly detects shift starts and resets only the current day's activity data
-- while preserving historical records

CREATE OR REPLACE FUNCTION public.corrected_activity_reset(
    p_check_time TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    rec RECORD;
    reset_count INTEGER := 0;
    manila_date DATE;
    current_time_minutes INTEGER;
    shift_start_minutes INTEGER;
    shift_end_minutes INTEGER;
    shift_text TEXT;
    is_night_shift BOOLEAN;
    shift_start_time TIMESTAMP WITHOUT TIME ZONE;
    time_diff_seconds INTEGER;
    activity_row RECORD;
    agent_name TEXT;
    should_reset BOOLEAN;
    current_manila_time TIMESTAMP WITHOUT TIME ZONE;
BEGIN
    -- Get the correct Manila time and date
    current_manila_time := p_check_time AT TIME ZONE 'Asia/Manila';
    manila_date := current_manila_time::date;
    current_time_minutes := EXTRACT(HOUR FROM current_manila_time) * 60 + EXTRACT(MINUTE FROM current_manila_time);
    
    RAISE NOTICE 'Current Manila time: %, Date: %, Minutes from midnight: %', 
        current_manila_time, manila_date, current_time_minutes;
    
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
        
        RAISE NOTICE 'Processing agent: % with shift: %', agent_name, shift_text;
        
        -- Parse shift time format like "6:15 AM - 3:00 PM"
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

        RAISE NOTICE 'Shift start minutes: %, Shift end minutes: %', shift_start_minutes, shift_end_minutes;
        
        -- Determine if this is a night shift (spans midnight)
        is_night_shift := shift_end_minutes < shift_start_minutes;
        
        -- Calculate the shift start time for today (Manila time)
        shift_start_time := manila_date + (shift_start_minutes || ' minutes')::INTERVAL;
        
        -- For night shifts, if current time is before shift start, the shift started yesterday
        IF is_night_shift AND current_time_minutes < shift_start_minutes THEN
            shift_start_time := (manila_date - INTERVAL '1 day') + (shift_start_minutes || ' minutes')::INTERVAL;
        END IF;
        
        RAISE NOTICE 'Calculated shift start time: %', shift_start_time;
        
        -- Check if we're within 5 minutes of the shift start time (more precise detection)
        time_diff_seconds := ABS(EXTRACT(EPOCH FROM (current_manila_time - shift_start_time)));
        
        RAISE NOTICE 'Time difference: % seconds (% minutes)', time_diff_seconds, (time_diff_seconds / 60);
        
        -- SCENARIO 1: We're near shift start time (within 5 minutes)
        IF time_diff_seconds <= 300 THEN
            should_reset := TRUE;
            RAISE NOTICE 'Scenario 1: Near shift start time for user % (within 5 minutes)', agent_name;
        END IF;
        
        -- SCENARIO 2: We're exactly at shift start time (within 1 minute)
        IF time_diff_seconds <= 60 THEN
            should_reset := TRUE;
            RAISE NOTICE 'Scenario 2: Exactly at shift start time for user %', agent_name;
        END IF;
        
        -- SCENARIO 3: Force reset if we're within the first 2 minutes of shift start
        -- This handles the case where we're at 6:15 AM and should reset
        IF current_time_minutes >= shift_start_minutes AND current_time_minutes <= (shift_start_minutes + 2) THEN
            should_reset := TRUE;
            RAISE NOTICE 'Scenario 3: Within first 2 minutes of shift for user % (current: % min, shift start: % min)', 
                agent_name, current_time_minutes, shift_start_minutes;
        END IF;
        
        -- Perform the reset if needed
        IF should_reset THEN
            RAISE NOTICE 'Performing reset for user % on date %', agent_name, manila_date;
            
            -- Check if we have an activity row for today (current Manila date)
            SELECT * INTO activity_row 
            FROM activity_data 
            WHERE user_id = rec.user_id 
            AND today_date = manila_date::text;
            
            -- If no activity row exists for today, create one with 0 values
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
                    manila_date::text, 
                    0, 
                    0, 
                    current_manila_time
                );
                
                reset_count := reset_count + 1;
                
                RAISE NOTICE 'Created new activity row for user % on date % with 0 values', agent_name, manila_date;
            ELSE
                -- Reset existing activity row to 0 values (ONLY for current date)
                UPDATE activity_data 
                SET 
                    today_active_seconds = 0,
                    today_inactive_seconds = 0,
                    is_currently_active = FALSE,
                    last_session_start = NULL,
                    updated_at = current_manila_time
                WHERE user_id = rec.user_id 
                AND today_date = manila_date::text;
                
                reset_count := reset_count + 1;
                
                RAISE NOTICE 'Reset activity data for user % on date % to 0 values', agent_name, manila_date;
            END IF;
        END IF;
    END LOOP;

    RETURN reset_count;
END;
$$;
