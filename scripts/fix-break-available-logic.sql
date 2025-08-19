-- Fix the is_break_available function to only return true at the exact start time
-- instead of for the entire break window

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
        -- This prevents the function from returning true for the entire break window
        
        IF current_time_only = break_start_time THEN
          RETURN TRUE; -- Break is available only at start time
        END IF;

        RETURN FALSE;
      END;
$function$;
