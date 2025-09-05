-- Fix night shift activity date calculation
-- The previous logic was incorrect for night shifts that cross midnight

CREATE OR REPLACE FUNCTION public.get_activity_date_for_shift_simple(p_user_id integer)
 RETURNS date
 LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
          current_time_only TIME;
          activity_date DATE;
      BEGIN
          -- Get current Manila time (UTC + 8 hours)
          current_time_manila := CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila';
          current_time_only := current_time_manila::TIME;
          
          -- Get agent's shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              -- No shift configured, use current date
              RETURN current_time_manila::DATE;
          END IF;
          
          -- Parse shift time
          shift_start_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%AM' THEN
                  replace(split_part(shift_info.shift_time, ' - ', 1), '12:', '00:')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME
          END;
          
          shift_end_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME
          END;
          
          -- Determine if it's a night shift (crosses midnight)
          is_night_shift := shift_start_time > shift_end_time;
          
          IF is_night_shift THEN
              -- NIGHT SHIFT LOGIC: Activity date is the day the shift starts
              -- For night shifts, if we're between shift start and end times, 
              -- we're in the shift that started the previous day
              IF current_time_only >= shift_start_time OR current_time_only < shift_end_time THEN
                  -- We're within the shift period, so the shift started the previous day
                  activity_date := current_time_manila::DATE - INTERVAL '1 day';
              ELSE
                  -- We're outside the shift period, so we're in today's shift
                  activity_date := current_time_manila::DATE;
              END IF;
          ELSE
              -- DAY SHIFT LOGIC: Activity date is always the current day
              -- For day shifts, activity resets each day at shift start time
              -- Day shifts never cross midnight, so always use current date
              activity_date := current_time_manila::DATE;
          END IF;
          
          RETURN activity_date;
      END;
      $function$
;
