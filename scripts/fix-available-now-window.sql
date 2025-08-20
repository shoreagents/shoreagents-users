-- Make "break available now" true for the first 60 seconds after the break start time
CREATE OR REPLACE FUNCTION public.is_break_available_now(
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
  break_already_taken BOOLEAN;
  minutes_since_start NUMERIC;
BEGIN
  SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
  IF NOT FOUND OR shift_info.shift_time IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM break_sessions
    WHERE agent_user_id = p_agent_user_id
      AND break_type = p_break_type
      AND break_date = p_current_time::DATE
  ) INTO break_already_taken;
  IF break_already_taken THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO break_windows FROM calculate_break_windows(shift_info.shift_time) LIMIT 1;
  current_time_only := p_current_time::TIME;

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

  minutes_since_start := EXTRACT(EPOCH FROM (current_time_only - break_start_time)) / 60.0;
  -- Handle wrapping across midnight
  IF minutes_since_start < -720 THEN
    minutes_since_start := minutes_since_start + 1440;
  END IF;

  -- True if within the first 60 seconds from break start
  RETURN minutes_since_start >= 0 AND minutes_since_start < (60.0/60.0);
END;
$function$;
