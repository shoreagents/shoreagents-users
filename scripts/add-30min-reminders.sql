-- Add 30-minute interval reminders within break windows
-- Sends: "You have not taken your <break> break yet!" every 30 minutes

-- Function to check if a 30-minute reminder is due within the break window
CREATE OR REPLACE FUNCTION is_break_reminder_due(
	p_agent_user_id INTEGER,
	p_break_type break_type_enum,
	p_current_time TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
	shift_info RECORD;
	break_windows RECORD;
	current_time_only TIME;
	break_start_time TIME;
	break_end_time TIME;
	break_already_taken BOOLEAN;
	minutes_since_start INTEGER;
	minutes_until_end INTEGER;
	reminder_window_tolerance INTEGER := 2; -- minutes, accounts for 2-min scheduler cadence
BEGIN
	-- Shift info
	SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
	IF NOT FOUND OR shift_info.shift_time IS NULL THEN
		RETURN FALSE;
	END IF;

	-- Already taken today?
	SELECT EXISTS(
		SELECT 1 FROM break_sessions
		WHERE agent_user_id = p_agent_user_id
		AND break_type = p_break_type
		AND break_date = p_current_time::DATE
	) INTO break_already_taken;
	IF break_already_taken THEN
		RETURN FALSE;
	END IF;

	-- Break windows
	SELECT * INTO break_windows FROM calculate_break_windows(shift_info.shift_time) LIMIT 1;
	IF NOT FOUND THEN
		RETURN FALSE;
	END IF;

	current_time_only := p_current_time::TIME;

	-- Map break type to window
	break_start_time := CASE p_break_type
		WHEN 'Morning' THEN break_windows.morning_start
		WHEN 'Lunch' THEN break_windows.lunch_start
		WHEN 'Afternoon' THEN break_windows.afternoon_start
		WHEN 'NightFirst' THEN break_windows.morning_start
		WHEN 'NightMeal' THEN break_windows.lunch_start
		WHEN 'NightSecond' THEN break_windows.afternoon_start
		ELSE NULL
	END;
	break_end_time := CASE p_break_type
		WHEN 'Morning' THEN break_windows.morning_end
		WHEN 'Lunch' THEN break_windows.lunch_end
		WHEN 'Afternoon' THEN break_windows.afternoon_end
		WHEN 'NightFirst' THEN break_windows.morning_end
		WHEN 'NightMeal' THEN break_windows.lunch_end
		WHEN 'NightSecond' THEN break_windows.afternoon_end
		ELSE NULL
	END;
	IF break_start_time IS NULL OR break_end_time IS NULL THEN
		RETURN FALSE;
	END IF;

	-- If before start, skip
	IF current_time_only < break_start_time THEN
		RETURN FALSE;
	END IF;

	-- Minutes since start (handle day wrap)
	minutes_since_start := EXTRACT(EPOCH FROM (current_time_only - break_start_time)) / 60;
	IF minutes_since_start < -720 THEN
		minutes_since_start := minutes_since_start + 1440;
	END IF;

	-- Minutes until end to avoid spamming past window
	minutes_until_end := EXTRACT(EPOCH FROM (break_end_time - current_time_only)) / 60;
	IF minutes_until_end < -720 THEN
		minutes_until_end := minutes_until_end + 1440;
	END IF;
	IF minutes_until_end <= 0 THEN
		RETURN FALSE; -- window ended
	END IF;

	-- Only start reminders 30 minutes after window opens
	IF minutes_since_start < 30 THEN
		RETURN FALSE;
	END IF;

	-- Fire every 30 minutes within tolerance
	IF (minutes_since_start % 30) BETWEEN 0 AND reminder_window_tolerance THEN
		RETURN TRUE;
	END IF;

	RETURN FALSE;
END;
$$;

-- Update the master checker to include 30-minute reminders
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

	FOR agent_record IN 
		SELECT DISTINCT u.id as user_id
		FROM users u
		INNER JOIN agents a ON u.id = a.user_id
		WHERE u.user_type = 'Agent'
	LOOP
		-- Available soon (15 min before start)
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

		-- Available now (exact start)
		IF EXISTS (SELECT 1 WHERE is_break_available_now(agent_record.user_id, 'Morning', check_time)) THEN
			PERFORM create_break_reminder_notification(agent_record.user_id, 'break_available', 'Morning');
			notifications_sent := notifications_sent + 1;
		END IF;
		IF EXISTS (SELECT 1 WHERE is_break_available_now(agent_record.user_id, 'Lunch', check_time)) THEN
			PERFORM create_break_reminder_notification(agent_record.user_id, 'break_available', 'Lunch');
			notifications_sent := notifications_sent + 1;
		END IF;
		IF EXISTS (SELECT 1 WHERE is_break_available_now(agent_record.user_id, 'Afternoon', check_time)) THEN
			PERFORM create_break_reminder_notification(agent_record.user_id, 'break_available', 'Afternoon');
			notifications_sent := notifications_sent + 1;
		END IF;
		IF EXISTS (SELECT 1 WHERE is_break_available_now(agent_record.user_id, 'NightFirst', check_time)) THEN
			PERFORM create_break_reminder_notification(agent_record.user_id, 'break_available', 'NightFirst');
			notifications_sent := notifications_sent + 1;
		END IF;
		IF EXISTS (SELECT 1 WHERE is_break_available_now(agent_record.user_id, 'NightMeal', check_time)) THEN
			PERFORM create_break_reminder_notification(agent_record.user_id, 'break_available', 'NightMeal');
			notifications_sent := notifications_sent + 1;
		END IF;
		IF EXISTS (SELECT 1 WHERE is_break_available_now(agent_record.user_id, 'NightSecond', check_time)) THEN
			PERFORM create_break_reminder_notification(agent_record.user_id, 'break_available', 'NightSecond');
			notifications_sent := notifications_sent + 1;
		END IF;

		-- 30-minute reminders within the window (uses missed_break message)
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

		-- Ending soon (15 min before end)
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

		-- Active break ending soon (uses 5-min remaining)
		IF is_break_ending_soon(agent_record.user_id, check_time) THEN
			PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon');
			notifications_sent := notifications_sent + 1;
		END IF;
	END LOOP;

	RETURN notifications_sent;
END;
$$;

COMMENT ON FUNCTION is_break_reminder_due(INTEGER, break_type_enum, TIMESTAMP WITHOUT TIME ZONE)
	IS 'Returns TRUE every 30 minutes within a break window if the break is not yet taken';
COMMENT ON FUNCTION check_break_reminders() IS 'Includes available-soon, available-now, 30-min reminders, ending-soon checks';
