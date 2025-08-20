-- Fix calculate_break_windows to properly calculate break times based on shift schedule
-- Morning break should start 2 hours after shift start (not 1 hour)

CREATE OR REPLACE FUNCTION calculate_break_windows(p_user_id INTEGER)
RETURNS TABLE(break_type break_type_enum, start_time TIME, end_time TIME)
LANGUAGE plpgsql
AS $$
DECLARE
    shift_info RECORD;
    shift_start_str TEXT;
    shift_end_str TEXT;
    shift_start TIME;
    shift_end TIME;
    shift_duration INTERVAL;
    morning_start TIME;
    morning_end TIME;
    lunch_start TIME;
    lunch_end TIME;
    afternoon_start TIME;
    afternoon_end TIME;
BEGIN
    -- Get shift information
    SELECT * INTO shift_info FROM get_agent_shift_info(p_user_id) LIMIT 1;

    IF NOT FOUND OR shift_info.shift_time IS NULL THEN
        RETURN; -- No shift info, return empty
    END IF;

    -- Simple parsing: split on " - " and extract time parts
    shift_start_str := SPLIT_PART(shift_info.shift_time, ' - ', 1);
    shift_end_str := SPLIT_PART(shift_info.shift_time, ' - ', 2);

    -- Convert to 24-hour format
    shift_start := CASE
        WHEN shift_start_str ~ '(\d{1,2}):(\d{2})\s*AM' THEN
            (REGEXP_REPLACE(shift_start_str, '(\d{1,2}):(\d{2})\s*AM', '\1:\2'))::TIME
        WHEN shift_start_str ~ '(\d{1,2}):(\d{2})\s*PM' THEN
            CASE
                WHEN REGEXP_REPLACE(shift_start_str, '(\d{1,2}):(\d{2})\s*PM', '\1')::INTEGER = 12 THEN
                    (REGEXP_REPLACE(shift_start_str, '(\d{1,2}):(\d{2})\s*PM', '\1:\2'))::TIME
                ELSE
                    ((REGEXP_REPLACE(shift_start_str, '(\d{1,2}):(\d{2})\s*PM', '\1')::INTEGER + 12) || ':' ||
                     REGEXP_REPLACE(shift_start_str, '(\d{1,2}):(\d{2})\s*PM', '\2'))::TIME
            END
        ELSE '00:00'::TIME
    END;

    shift_end := CASE
        WHEN shift_end_str ~ '(\d{1,2}):(\d{2})\s*AM' THEN
            (REGEXP_REPLACE(shift_end_str, '(\d{1,2}):(\d{2})\s*AM', '\1:\2'))::TIME
        WHEN shift_end_str ~ '(\d{1,2}):(\d{2})\s*PM' THEN
            CASE
                WHEN REGEXP_REPLACE(shift_end_str, '(\d{1,2}):(\d{2})\s*PM', '\1')::INTEGER = 12 THEN
                    (REGEXP_REPLACE(shift_end_str, '(\d{1,2}):(\d{2})\s*PM', '\1:\2'))::TIME
                ELSE
                    ((REGEXP_REPLACE(shift_end_str, '(\d{1,2}):(\d{2})\s*PM', '\1')::INTEGER + 12) || ':' ||
                     REGEXP_REPLACE(shift_end_str, '(\d{1,2}):(\d{2})\s*PM', '\2'))::TIME
            END
        ELSE '00:00'::TIME
    END;

    -- Calculate shift duration
    shift_duration := shift_end - shift_start;

    -- Calculate break windows dynamically based on shift times
    IF shift_duration >= '8 hours'::INTERVAL THEN
        -- 8+ hour shift: Morning, Lunch, Afternoon breaks
        
        -- Morning break: 2 hours after shift start (1-hour window)
        morning_start := shift_start + INTERVAL '2 hours';
        morning_end := morning_start + INTERVAL '1 hour';
        
        -- Lunch break: mid-shift (3-hour window)
        lunch_start := shift_start + INTERVAL '4 hours';
        lunch_end := shift_end - INTERVAL '2 hours';
        
        -- Afternoon break: 1.25 hours before shift end (1-hour window)  
        afternoon_end := shift_end - INTERVAL '15 minutes';
        afternoon_start := afternoon_end - INTERVAL '1 hour';
        
        RETURN QUERY VALUES 
            ('Morning'::break_type_enum, morning_start, morning_end),
            ('Lunch'::break_type_enum, lunch_start, lunch_end),
            ('Afternoon'::break_type_enum, afternoon_start, afternoon_end);
            
    ELSIF shift_duration >= '6 hours'::INTERVAL THEN
        -- 6-8 hour shift: Morning and Lunch breaks
        
        -- Morning break: 2 hours after shift start
        morning_start := shift_start + INTERVAL '2 hours';
        morning_end := morning_start + INTERVAL '1 hour';
        
        -- Lunch break: mid-shift
        lunch_start := shift_start + INTERVAL '3 hours';
        lunch_end := shift_end - INTERVAL '1 hour';
        
        RETURN QUERY VALUES 
            ('Morning'::break_type_enum, morning_start, morning_end),
            ('Lunch'::break_type_enum, lunch_start, lunch_end);
            
    ELSIF shift_duration >= '4 hours'::INTERVAL THEN
        -- 4-6 hour shift: Just one break (Morning)
        
        -- Morning break: 2 hours after shift start
        morning_start := shift_start + INTERVAL '2 hours';
        morning_end := morning_start + INTERVAL '1 hour';
        
        RETURN QUERY VALUES 
            ('Morning'::break_type_enum, morning_start, morning_end);
    END IF;

    RETURN;
END;
$$;
