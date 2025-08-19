-- Fix duplicate notifications by ensuring only users with valid shifts get notifications
-- This fixes both get_agent_shift_info and is_break_ending_soon functions

-- Fix 1: Update get_agent_shift_info to NOT use default values
-- Users without shifts should get NULL, not default shift times
CREATE OR REPLACE FUNCTION public.get_agent_shift_info(p_agent_user_id integer)
RETURNS TABLE(user_id integer, shift_time text, shift_period text, shift_schedule text)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        u.id as user_id,
        ji.shift_time,  -- Remove COALESCE - return actual value or NULL
        ji.shift_period, -- Remove COALESCE - return actual value or NULL
        ji.shift_schedule -- Remove COALESCE - return actual value or NULL
    FROM users u
    LEFT JOIN agents a ON u.id = a.user_id
    LEFT JOIN job_info ji ON ji.agent_user_id = a.user_id
    WHERE u.id = p_agent_user_id;
END;
$function$;

-- Fix 2: Update is_break_ending_soon to return false for users with no shift time
-- This prevents users without shifts from getting break notifications
CREATE OR REPLACE FUNCTION public.is_break_ending_soon(
    p_agent_user_id integer,
    p_current_time timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text)
)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    shift_info RECORD;
    break_windows RECORD;
    current_time_only TIME;
    break_end_time TIME;
    minutes_until_window_ends INTEGER;
    break_already_taken BOOLEAN;
    break_type_to_check break_type_enum;
BEGIN
    -- Get agent shift information
    SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;

    IF NOT FOUND THEN
        RETURN FALSE; -- User not found
    END IF;

    -- CRITICAL FIX: Check if user has a valid shift time
    -- If shift_time is NULL, the user has no shift configured
    IF shift_info.shift_time IS NULL THEN
        RETURN FALSE; -- User has no shift, so no breaks to end
    END IF;

    -- Get break windows for this shift
    SELECT * INTO break_windows FROM calculate_break_windows(shift_info.shift_time) LIMIT 1;

    current_time_only := p_current_time::TIME;

    -- Check each break type to see if its window is ending soon
    -- Morning break window ending soon?
    SELECT EXISTS(
        SELECT 1 FROM break_sessions
        WHERE agent_user_id = p_agent_user_id
        AND break_type = 'Morning'
        AND break_date = p_current_time::DATE
    ) INTO break_already_taken;

    IF NOT break_already_taken THEN
        minutes_until_window_ends := EXTRACT(EPOCH FROM (break_windows.morning_end - current_time_only)) / 60;
        IF minutes_until_window_ends < -720 THEN
            minutes_until_window_ends := minutes_until_window_ends + 1440;
        END IF;
        IF minutes_until_window_ends > 0 AND minutes_until_window_ends <= 15 THEN
            RETURN TRUE; -- Morning break window ending in 15 minutes
        END IF;
    END IF;

    -- Lunch break window ending soon?
    SELECT EXISTS(
        SELECT 1 FROM break_sessions
        WHERE agent_user_id = p_agent_user_id
        AND break_type = 'Lunch'
        AND break_date = p_current_time::DATE
    ) INTO break_already_taken;

    IF NOT break_already_taken THEN
        minutes_until_window_ends := EXTRACT(EPOCH FROM (break_windows.lunch_end - current_time_only)) / 60;
        IF minutes_until_window_ends < -720 THEN
            minutes_until_window_ends := minutes_until_window_ends + 1440;
        END IF;
        IF minutes_until_window_ends > 0 AND minutes_until_window_ends <= 15 THEN
            RETURN TRUE; -- Lunch break window ending in 15 minutes
        END IF;
    END IF;

    -- Afternoon break window ending soon?
    SELECT EXISTS(
        SELECT 1 FROM break_sessions
        WHERE agent_user_id = p_agent_user_id
        AND break_type = 'Afternoon'
        AND break_date = p_current_time::DATE
    ) INTO break_already_taken;

    IF NOT break_already_taken THEN
        minutes_until_window_ends := EXTRACT(EPOCH FROM (break_windows.afternoon_end - current_time_only)) / 60;
        IF minutes_until_window_ends < -720 THEN
            minutes_until_window_ends := minutes_until_window_ends + 1440;
        END IF;
        IF minutes_until_window_ends > 0 AND minutes_until_window_ends <= 15 THEN
            RETURN TRUE; -- Afternoon break window ending in 15 minutes
        END IF;
    END IF;

    -- Check night shift breaks with NEW enum values
    SELECT EXISTS(
        SELECT 1 FROM break_sessions
        WHERE agent_user_id = p_agent_user_id
        AND break_type = 'NightFirst'
        AND break_date = p_current_time::DATE
    ) INTO break_already_taken;

    IF NOT break_already_taken THEN
        minutes_until_window_ends := EXTRACT(EPOCH FROM (break_windows.morning_end - current_time_only)) / 60;
        IF minutes_until_window_ends < -720 THEN
            minutes_until_window_ends := minutes_until_window_ends + 1440;
        END IF;
        IF minutes_until_window_ends > 0 AND minutes_until_window_ends <= 15 THEN
            RETURN TRUE;
        END IF;
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM break_sessions
        WHERE agent_user_id = p_agent_user_id
        AND break_type = 'NightMeal'
        AND break_date = p_current_time::DATE
    ) INTO break_already_taken;

    IF NOT break_already_taken THEN
        minutes_until_window_ends := EXTRACT(EPOCH FROM (break_windows.lunch_end - current_time_only)) / 60;
        IF minutes_until_window_ends < -720 THEN
            minutes_until_window_ends := minutes_until_window_ends + 1440;
        END IF;
        IF minutes_until_window_ends > 0 AND minutes_until_window_ends <= 15 THEN
            RETURN TRUE;
        END IF;
    END IF;

    SELECT EXISTS(
        SELECT 1 FROM break_sessions
        WHERE agent_user_id = p_agent_user_id
        AND break_type = 'NightSecond'
        AND break_date = p_current_time::DATE
    ) INTO break_already_taken;

    IF NOT break_already_taken THEN
        minutes_until_window_ends := EXTRACT(EPOCH FROM (break_windows.afternoon_end - current_time_only)) / 60;
        IF minutes_until_window_ends < -720 THEN
            minutes_until_window_ends := minutes_until_window_ends + 1440;
        END IF;
        IF minutes_until_window_ends > 0 AND minutes_until_window_ends <= 15 THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$function$;

-- Also fix other break notification functions to be consistent
-- Fix is_break_available to return false for users with no shift time
CREATE OR REPLACE FUNCTION public.is_break_available(
    p_agent_user_id integer,
    p_break_type break_type_enum,
    p_current_time timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text)
)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    shift_info RECORD;
    break_windows RECORD;
    current_time_only TIME;
    break_start_time TIME;
    break_end_time TIME;
    break_already_taken BOOLEAN;
    minutes_since_start INTEGER;
BEGIN
    -- Get agent shift information
    SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- CRITICAL FIX: Check if user has a valid shift time
    IF shift_info.shift_time IS NULL THEN
        RETURN FALSE; -- User has no shift, so no breaks available
    END IF;

    -- Check if break was already taken today
    SELECT EXISTS(
        SELECT 1 FROM break_sessions
        WHERE agent_user_id = p_agent_user_id
        AND break_type = p_break_type
        AND break_date = p_current_time::DATE
    ) INTO break_already_taken;

    IF break_already_taken THEN
        RETURN FALSE; -- Break already taken
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

    -- Break is available ONLY at the exact start time
    IF current_time_only = break_start_time THEN
        RETURN TRUE; -- Break is available only at start time
    END IF;

    RETURN FALSE;
END;
$function$;

-- Fix is_break_available_soon to return false for users with no shift time
CREATE OR REPLACE FUNCTION public.is_break_available_soon(
    p_agent_user_id integer,
    p_break_type break_type_enum,
    p_current_time timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text)
)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    shift_info RECORD;
    break_windows RECORD;
    current_time_only TIME;
    break_start_time TIME;
    minutes_until_start INTEGER;
    break_already_taken BOOLEAN;
BEGIN
    -- Get agent shift information
    SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- CRITICAL FIX: Check if user has a valid shift time
    IF shift_info.shift_time IS NULL THEN
        RETURN FALSE; -- User has no shift, so no breaks available soon
    END IF;

    -- Check if break was already taken today
    SELECT EXISTS(
        SELECT 1 FROM break_sessions
        WHERE agent_user_id = p_agent_user_id
        AND break_type = p_break_type
        AND break_date = p_current_time::DATE
    ) INTO break_already_taken;

    IF break_already_taken THEN
        RETURN FALSE; -- Break already taken
    END IF;

    -- Get break windows for this shift
    SELECT * INTO break_windows FROM calculate_break_windows(shift_info.shift_time) LIMIT 1;

    current_time_only := p_current_time::TIME;

    -- Determine break start time based on break type
    CASE p_break_type
        WHEN 'Morning' THEN
            break_start_time := break_windows.morning_start;
        WHEN 'Lunch' THEN
            break_start_time := break_windows.lunch_start;
        WHEN 'Afternoon' THEN
            break_start_time := break_windows.afternoon_start;
        WHEN 'NightFirst' THEN
            break_start_time := break_windows.morning_start;
        WHEN 'NightMeal' THEN
            break_start_time := break_windows.lunch_start;
        WHEN 'NightSecond' THEN
            break_start_time := break_windows.afternoon_start;
        ELSE
            RETURN FALSE;
    END CASE;

    IF break_start_time IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Break is available soon if it starts in 15 minutes
    minutes_until_start := EXTRACT(EPOCH FROM (break_start_time - current_time_only)) / 60;
    
    -- Handle time wrapping (e.g., if current time is 11:59 PM and break starts at 12:00 AM next day)
    IF minutes_until_start < -720 THEN
        minutes_until_start := minutes_until_start + 1440;
    END IF;

    -- Return true if break starts in 15 minutes or less
    RETURN minutes_until_start > 0 AND minutes_until_start <= 15;
END;
$function$;

-- Fix is_break_missed to return false for users with no shift time
CREATE OR REPLACE FUNCTION public.is_break_missed(
    p_agent_user_id integer,
    p_break_type break_type_enum,
    p_current_time timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text)
)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    shift_info RECORD;
    break_windows RECORD;
    current_time_only TIME;
    break_start_time TIME;
    break_end_time TIME;
    break_already_taken BOOLEAN;
    minutes_since_start INTEGER;
BEGIN
    -- Get agent shift information
    SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- CRITICAL FIX: Check if user has a valid shift time
    IF shift_info.shift_time IS NULL THEN
        RETURN FALSE; -- User has no shift, so no breaks to miss
    END IF;

    -- Check if break was already taken today
    SELECT EXISTS(
        SELECT 1 FROM break_sessions
        WHERE agent_user_id = p_agent_user_id
        AND break_type = p_break_type
        AND break_date = p_current_time::DATE
    ) INTO break_already_taken;

    IF break_already_taken THEN
        RETURN FALSE; -- Break already taken
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

    -- Break is missed if:
    -- 1. Current time is past the break end time
    -- 2. Break was not taken
    -- 3. Current time is at least 30 minutes past the break start time

    IF current_time_only > break_end_time THEN
        -- Check if we're at least 30 minutes past the start time
        minutes_since_start := EXTRACT(EPOCH FROM (current_time_only - break_start_time)) / 60;
        
        -- Handle time wrapping (e.g., if break started at 11:30 PM and current time is 12:00 AM next day)
        IF minutes_since_start < -720 THEN
            minutes_since_start := minutes_since_start + 1440;
        END IF;

        -- Return true if at least 30 minutes have passed since break start
        RETURN minutes_since_start >= 30;
    END IF;

    RETURN FALSE;
END;
$function$;

-- Summary of fixes applied
COMMENT ON FUNCTION public.get_agent_shift_info(integer) IS 'Fixed: No longer returns default shift times for users without shifts';
COMMENT ON FUNCTION public.is_break_ending_soon(integer, timestamp without time zone) IS 'Fixed: Returns false for users without shift times';
COMMENT ON FUNCTION public.is_break_available(integer, break_type_enum, timestamp without time zone) IS 'Fixed: Returns false for users without shift times';
COMMENT ON FUNCTION public.is_break_available_soon(integer, break_type_enum, timestamp without time zone) IS 'Fixed: Returns false for users without shift times';
COMMENT ON FUNCTION public.is_break_missed(integer, break_type_enum, timestamp without time zone) IS 'Fixed: Returns false for users without shift times';
