-- Redefine check_break_reminders to use day/night gating per agent shift
CREATE OR REPLACE FUNCTION check_break_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  agent_record RECORD;
  notifications_sent INTEGER := 0;
  check_time TIMESTAMP := (NOW() AT TIME ZONE 'Asia/Manila');
  shift_info RECORD;
  shift_text TEXT;
  start_time_str TEXT;
  end_time_str TEXT;
  start_time TIME;
  end_time TIME;
  is_night_shift BOOLEAN := FALSE;
BEGIN
  FOR agent_record IN 
    SELECT DISTINCT u.id AS user_id
    FROM users u
    INNER JOIN agents a ON u.id = a.user_id
    WHERE u.user_type = 'Agent'
  LOOP
    -- Load shift info
    shift_text := NULL; is_night_shift := FALSE; start_time := NULL; end_time := NULL;
    SELECT shift_time INTO shift_text FROM get_agent_shift_info(agent_record.user_id) LIMIT 1;

    IF shift_text IS NULL OR trim(shift_text) = '' THEN
      CONTINUE; -- no shift configured: skip all notifications
    END IF;

    -- Parse "h:mm AM - h:mm PM"
    BEGIN
      start_time_str := trim(split_part(shift_text, ' - ', 1));
      end_time_str := trim(split_part(shift_text, ' - ', 2));

      -- Convert to TIME respecting AM/PM
      start_time := CASE 
        WHEN start_time_str ILIKE '12:% AM' THEN replace(start_time_str, '12:', '00:')::time
        WHEN start_time_str ILIKE '% PM' AND start_time_str NOT ILIKE '12:% PM' THEN (split_part(start_time_str, ' ', 1)::time + interval '12 hours')::time
        ELSE split_part(start_time_str, ' ', 1)::time
      END;

      end_time := CASE 
        WHEN end_time_str ILIKE '12:% AM' THEN replace(end_time_str, '12:', '00:')::time
        WHEN end_time_str ILIKE '% PM' AND end_time_str NOT ILIKE '12:% PM' THEN (split_part(end_time_str, ' ', 1)::time + interval '12 hours')::time
        ELSE split_part(end_time_str, ' ', 1)::time
      END;
    EXCEPTION WHEN OTHERS THEN
      -- If parsing fails, skip this agent to avoid wrong notifications
      CONTINUE;
    END;

    IF start_time IS NULL OR end_time IS NULL THEN
      CONTINUE;
    END IF;

    is_night_shift := (start_time > end_time);

    -- DAY SHIFT: Morning/Lunch/Afternoon only
    IF NOT is_night_shift THEN
      -- available soon (15 min before)
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

      -- available now (exact start) if function exists
      IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_break_available_now') THEN
        IF is_break_available_now(agent_record.user_id, 'Morning', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'break_available', 'Morning');
          notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_available_now(agent_record.user_id, 'Lunch', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'break_available', 'Lunch');
          notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_available_now(agent_record.user_id, 'Afternoon', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'break_available', 'Afternoon');
          notifications_sent := notifications_sent + 1;
        END IF;
      END IF;

      -- 30-min reminders (if function exists)
      IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_break_reminder_due') THEN
        IF is_break_reminder_due(agent_record.user_id, 'Morning', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Morning');
          notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_reminder_due(agent_record.user_id, 'Lunch', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Lunch');
          notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_reminder_due(agent_record.user_id, 'Afternoon', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Afternoon');
          notifications_sent := notifications_sent + 1;
        END IF;
      END IF;

      -- ending soon (15 min before window end if function exists)
      IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_break_window_ending_soon') THEN
        IF is_break_window_ending_soon(agent_record.user_id, 'Morning', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Morning');
          notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_window_ending_soon(agent_record.user_id, 'Lunch', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Lunch');
          notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_window_ending_soon(agent_record.user_id, 'Afternoon', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Afternoon');
          notifications_sent := notifications_sent + 1;
        END IF;
      END IF;

    ELSE
      -- NIGHT SHIFT: NightFirst/NightMeal/NightSecond only
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

      IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_break_available_now') THEN
        IF is_break_available_now(agent_record.user_id, 'NightFirst', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'break_available', 'NightFirst');
          notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_available_now(agent_record.user_id, 'NightMeal', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'break_available', 'NightMeal');
          notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_available_now(agent_record.user_id, 'NightSecond', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'break_available', 'NightSecond');
          notifications_sent := notifications_sent + 1;
        END IF;
      END IF;

      IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_break_reminder_due') THEN
        IF is_break_reminder_due(agent_record.user_id, 'NightFirst', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightFirst');
          notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_reminder_due(agent_record.user_id, 'NightMeal', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightMeal');
          notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_reminder_due(agent_record.user_id, 'NightSecond', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightSecond');
          notifications_sent := notifications_sent + 1;
        END IF;
      END IF;

      IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_break_window_ending_soon') THEN
        IF is_break_window_ending_soon(agent_record.user_id, 'NightFirst', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'NightFirst');
          notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_window_ending_soon(agent_record.user_id, 'NightMeal', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'NightMeal');
          notifications_sent := notifications_sent + 1;
        END IF;
        IF is_break_window_ending_soon(agent_record.user_id, 'NightSecond', check_time) THEN
          PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'NightSecond');
          notifications_sent := notifications_sent + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;
  RETURN notifications_sent;
END;
$$;
