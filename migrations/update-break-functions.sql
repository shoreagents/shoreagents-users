-- =====================================================
-- ADD BREAK EXPIRATION TRACKING
-- =====================================================

-- Add is_expired column to break_sessions table
ALTER TABLE break_sessions ADD COLUMN IF NOT EXISTS is_expired BOOLEAN DEFAULT FALSE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_break_sessions_expired ON break_sessions(agent_user_id, break_type, is_expired);

-- =====================================================
-- UPDATE BREAK FUNCTIONS TO USE BREAKS TABLE DATA
-- =====================================================
-- This migration modifies calculate_break_windows to use custom break settings
-- from the breaks table when available, falling back to defaults when not set
-- =====================================================

-- Drop and recreate calculate_break_windows function to use breaks table
DROP FUNCTION IF EXISTS public.calculate_break_windows(integer);

CREATE OR REPLACE FUNCTION public.calculate_break_windows(p_user_id integer)
RETURNS TABLE(break_type break_type_enum, start_time time without time zone, end_time time without time zone)
LANGUAGE plpgsql
AS $function$
      DECLARE
          custom_break RECORD;
      BEGIN
          -- Return only custom break windows from the breaks table
          -- Users must set their own break schedules
          FOR custom_break IN
              SELECT b.break_type, b.start_time, b.end_time
              FROM public.breaks b
              WHERE b.user_id = p_user_id 
              AND b.is_active = true
              ORDER BY b.break_type
          LOOP
              RETURN QUERY SELECT 
                  custom_break.break_type,
                  custom_break.start_time,
                  custom_break.end_time;
          END LOOP;
      END;
$function$;

-- Update the comment to reflect the new behavior
COMMENT ON FUNCTION public.calculate_break_windows(integer) 
    IS 'Returns only custom break windows from breaks table - users must configure their own break schedules';

-- =====================================================
-- UPDATE NOTIFICATION FUNCTIONS TO USE CUSTOM BREAKS
-- =====================================================

-- Update is_break_available_now to use custom break windows
CREATE OR REPLACE FUNCTION public.is_break_available_now(p_agent_user_id integer, p_break_type break_type_enum, p_current_time timestamp without time zone DEFAULT NULL::timestamp without time zone)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
      DECLARE
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_start_time TIME;
          break_end_time TIME;
          break_already_taken BOOLEAN;
      BEGIN
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time;
          END IF;
          
          current_time_only := current_time_manila::TIME;
          
          -- Check if break was already taken today
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = current_time_manila::DATE
              AND end_time IS NOT NULL
          ) INTO break_already_taken;
          
          IF break_already_taken THEN
              RETURN FALSE; -- Break already taken
          END IF;
          
          -- Get break window from calculate_break_windows (only returns custom breaks)
          SELECT start_time, end_time INTO break_start_time, break_end_time
          FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No custom break configured for this type
          END IF;
          
          -- Check if current time is within the break window
          RETURN current_time_only >= break_start_time AND current_time_only < break_end_time;
      END;
      $function$;

-- Update is_break_available_soon to use custom break windows
CREATE OR REPLACE FUNCTION public.is_break_available_soon(p_agent_user_id integer, p_break_type break_type_enum, p_current_time timestamp without time zone DEFAULT NULL::timestamp without time zone)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
      DECLARE
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_start_time TIME;
          minutes_until_break INTEGER;
          break_already_taken BOOLEAN;
      BEGIN
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time;
          END IF;
          
          current_time_only := current_time_manila::TIME;
          
          -- Check if break was already taken today
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = current_time_manila::DATE
              AND end_time IS NOT NULL
          ) INTO break_already_taken;
          
          IF break_already_taken THEN
              RETURN FALSE; -- Break already taken
          END IF;
          
          -- Get break start time from calculate_break_windows (only returns custom breaks)
          SELECT start_time INTO break_start_time
          FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No custom break configured for this type
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
      $function$;

-- Update is_break_missed to use custom break windows
CREATE OR REPLACE FUNCTION public.is_break_missed(p_agent_user_id integer, p_break_type break_type_enum, p_current_time timestamp without time zone DEFAULT NULL::timestamp without time zone)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
      DECLARE
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_start_time TIME;
          break_end_time TIME;
          minutes_since_break_start INTEGER;
          break_already_taken BOOLEAN;
          break_currently_active BOOLEAN;
          current_date_manila DATE;
          last_notification_time TIMESTAMP;
          minutes_since_last_notification INTEGER;
      BEGIN
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time;
          END IF;
          
          current_time_only := current_time_manila::TIME;
          current_date_manila := current_time_manila::DATE;
          
          -- Check if break is currently active
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = current_date_manila
              AND end_time IS NULL
          ) INTO break_currently_active;
          
          IF break_currently_active THEN
              RETURN FALSE; -- Break is currently active, don't send reminder
          END IF;
          
          -- Check if break was already taken today
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = current_date_manila
              AND end_time IS NOT NULL
          ) INTO break_already_taken;
          
          IF break_already_taken THEN
              RETURN FALSE; -- Break already taken
          END IF;
          
          -- Get break window from calculate_break_windows (only returns custom breaks)
          SELECT start_time, end_time INTO break_start_time, break_end_time
          FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No custom break configured for this type
          END IF;
          
          -- Check if we're within the break window (missed break should be sent WHILE in window)
          IF current_time_only < break_start_time OR current_time_only >= break_end_time THEN
              RETURN FALSE; -- Outside break window, don't send missed notification
          END IF;
          
          -- Calculate minutes since break window started
          minutes_since_break_start := EXTRACT(EPOCH FROM (current_time_only - break_start_time)) / 60;
          
          -- Check if it's been at least 30 minutes since break window started
          -- This ensures we don't send "you haven't taken" too early
          IF minutes_since_break_start < 30 THEN
              RETURN FALSE; -- Too early to send missed break notification
          END IF;
          
          -- Check if we're at a 30-minute interval (30, 60, 90, etc.)
          -- This ensures we send notifications every 30 minutes while in the window
          -- Use a small tolerance for floating-point calculations
          IF ABS(minutes_since_break_start % 30) > 1 AND ABS(minutes_since_break_start % 30 - 30) > 1 THEN
              RETURN FALSE; -- Not at a 30-minute interval (within 1-minute tolerance)
          END IF;
          
          -- Check if we've sent a notification in the last 25 minutes
          -- This prevents duplicate notifications within the same 30-minute interval
          SELECT MAX(created_at) INTO last_notification_time
          FROM notifications
          WHERE user_id = p_agent_user_id
          AND category = 'break'
          AND payload->>'break_type' = p_break_type::text
          AND payload->>'notification_type' = 'missed_break'
          AND created_at >= current_time_manila - INTERVAL '1 hour';
          
          IF last_notification_time IS NOT NULL THEN
              minutes_since_last_notification := EXTRACT(EPOCH FROM (current_time_manila - last_notification_time)) / 60;
              IF minutes_since_last_notification < 25 THEN
                  RETURN FALSE; -- Too soon since last notification
              END IF;
          END IF;
          
          RETURN TRUE; -- Break is missed and notification should be sent
      END;
      $function$;

-- Update is_break_window_ending_soon to use custom break windows
CREATE OR REPLACE FUNCTION public.is_break_window_ending_soon(p_agent_user_id integer, p_break_type break_type_enum, p_check_time timestamp with time zone DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql
AS $function$
      DECLARE
          break_windows RECORD;
          current_time_only TIME;
          break_end_time TIME;
          minutes_until_expiry INTEGER;
          break_already_taken BOOLEAN;
          break_currently_active BOOLEAN;
      BEGIN
          -- Check if break is currently active
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = (p_check_time AT TIME ZONE 'Asia/Manila')::DATE
              AND end_time IS NULL
          ) INTO break_currently_active;
          
          IF break_currently_active THEN
              RETURN FALSE; -- Break is currently active, don't send ending soon notification
          END IF;
          
          -- Check if break was already taken today
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = (p_check_time AT TIME ZONE 'Asia/Manila')::DATE
              AND end_time IS NOT NULL
          ) INTO break_already_taken;
          
          IF break_already_taken THEN
              RETURN FALSE; -- Break already taken, no need for ending soon notification
          END IF;
          
          -- Get break windows using calculate_break_windows (only returns custom breaks)
          SELECT * INTO break_windows FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No custom break configured for this type
          END IF;
          
          current_time_only := (p_check_time AT TIME ZONE 'Asia/Manila')::TIME;
          break_end_time := break_windows.end_time;
          
          -- Calculate minutes until break window expires
          IF current_time_only > break_end_time THEN
              minutes_until_expiry := 0;
          ELSE
              minutes_until_expiry := EXTRACT(EPOCH FROM (break_end_time - current_time_only)) / 60;
          END IF;
          
          -- Return true if break window is ending in 15 minutes (with 1-minute tolerance)
          -- This means between 14-16 minutes before the end time
          -- Example: Break ends at 10:16 AM, notification sent at 10:01-10:03 AM
          RETURN (minutes_until_expiry >= 14 AND minutes_until_expiry <= 16);
      END;
      $function$;

COMMENT ON FUNCTION public.is_break_window_ending_soon(int4, break_type_enum, timestamptz) 
    IS 'UPDATED: Only uses custom break windows from breaks table - users must configure their own break schedules';

-- =====================================================
-- UPDATE ADDITIONAL BREAK FUNCTIONS
-- =====================================================

-- Drop unused is_break_available function
DROP FUNCTION IF EXISTS public.is_break_available(integer, break_type_enum, timestamp);

-- Update is_break_available_now_notification_sent to use custom break windows
CREATE OR REPLACE FUNCTION public.is_break_available_now_notification_sent(p_agent_user_id integer, p_break_type break_type_enum, p_check_time timestamp without time zone)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
      DECLARE
          current_time_manila TIMESTAMP;
          break_start_time TIME;
          break_end_time TIME;
          notification_exists BOOLEAN;
      BEGIN
          -- Get current Manila time
          current_time_manila := p_check_time;
          
          -- Get break window from calculate_break_windows (only returns custom breaks)
          SELECT start_time, end_time INTO break_start_time, break_end_time
          FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No custom break configured for this type
          END IF;
          
          -- Check if "available_now" notification was already sent for this break period today
          -- We check for notifications sent today, not just within the current break window
          SELECT EXISTS(
              SELECT 1 FROM notifications 
              WHERE user_id = p_agent_user_id 
              AND category = 'break'
              AND payload->>'reminder_type' = 'available_now'
              AND payload->>'break_type' = p_break_type::text
              AND DATE(created_at AT TIME ZONE 'Asia/Manila') = current_time_manila::DATE
          ) INTO notification_exists;
          
          RETURN notification_exists;
      END;
$function$;

COMMENT ON FUNCTION public.is_break_available_now_notification_sent(int4, break_type_enum, timestamp) 
    IS 'UPDATED: Uses only custom break windows from breaks table - users must configure their own break schedules';


-- DROP FUNCTION public.check_break_reminders();

CREATE OR REPLACE FUNCTION public.check_break_reminders()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
            DECLARE
                agent_record RECORD;
                notifications_sent INTEGER := 0;
                check_time TIMESTAMP;
            BEGIN
                check_time := NOW() AT TIME ZONE 'Asia/Manila';

                -- NOTE: Task notifications are now handled by a separate scheduler
                -- This function only handles break-related notifications

                -- Loop through all active agents
                FOR agent_record IN
                    SELECT DISTINCT u.id as user_id
                    FROM users u
                    INNER JOIN agents a ON u.id = a.user_id
                    WHERE u.user_type = 'Agent'
                LOOP
                    -- Check for breaks available soon (15 minutes before)
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

                    -- Check for night shift breaks available soon
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

                    -- Check for breaks that are currently available/active (ONLY if notification not already sent)
                    IF is_break_available_now(agent_record.user_id, 'Morning', check_time)
                       AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'Morning', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Morning');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_available_now(agent_record.user_id, 'Lunch', check_time)
                       AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'Lunch', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Lunch');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_available_now(agent_record.user_id, 'Afternoon', check_time)
                       AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'Afternoon', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Afternoon');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    -- Check for night shift breaks currently available (ONLY if notification not already sent)
                    IF is_break_available_now(agent_record.user_id, 'NightFirst', check_time)
                       AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'NightFirst', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightFirst');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_available_now(agent_record.user_id, 'NightMeal', check_time)
                       AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'NightMeal', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightMeal');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_available_now(agent_record.user_id, 'NightSecond', check_time)
                       AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'NightSecond', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightSecond');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    -- Check for missed breaks (30 minutes after break becomes available)
                    -- This will send "You have not taken your [Break] yet!" notifications
                    IF is_break_missed(agent_record.user_id, 'Morning', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Morning');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_missed(agent_record.user_id, 'Lunch', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Lunch');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_missed(agent_record.user_id, 'Afternoon', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Afternoon');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    -- Check for night shift missed breaks
                    IF is_break_missed(agent_record.user_id, 'NightFirst', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightFirst');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_missed(agent_record.user_id, 'NightMeal', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightMeal');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_missed(agent_record.user_id, 'NightSecond', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightSecond');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    -- Check for break window ending soon (15 minutes before break window expires)
                    -- This prevents generic "Break ending soon" notifications
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

                    -- Check for night shift break windows ending soon
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
                END LOOP;

                RETURN notifications_sent;
            END;
            $function$
;


-- DROP FUNCTION public.get_agent_daily_breaks(int4);

CREATE OR REPLACE FUNCTION public.get_agent_daily_breaks(p_agent_user_id integer)
 RETURNS TABLE(break_type break_type_enum, break_count integer, total_minutes integer, can_take_break boolean)
 LANGUAGE plpgsql
AS $function$
      BEGIN
          RETURN QUERY
          WITH break_types AS (
              SELECT unnest(enum_range(NULL::break_type_enum)) AS bt
          ),
          today_breaks AS (
              SELECT 
                  bs.break_type,
                  COUNT(*) as break_count,
                  COALESCE(SUM(bs.duration_minutes), 0) as total_minutes
              FROM public.break_sessions bs
              WHERE bs.agent_user_id = p_agent_user_id
              AND bs.break_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
              AND bs.end_time IS NOT NULL
              AND bs.is_expired = FALSE  -- Only count actually used breaks, not missed ones
              GROUP BY bs.break_type
          )
          SELECT 
              bt.bt as break_type,
              COALESCE(tb.break_count, 0)::INTEGER as break_count,
              COALESCE(tb.total_minutes, 0)::INTEGER as total_minutes,
              (COALESCE(tb.break_count, 0) = 0) as can_take_break
          FROM break_types bt
          LEFT JOIN today_breaks tb ON bt.bt = tb.break_type
          ORDER BY bt.bt;
      END;
$function$
;

COMMENT ON FUNCTION public.get_agent_daily_breaks(int4) IS 'UPDATED: Only counts actually used breaks (is_expired = FALSE), not missed break sessions';

-- =====================================================
-- BREAK EXPIRATION FUNCTIONS
-- =====================================================

-- Function to check if a break window has expired
CREATE OR REPLACE FUNCTION public.is_break_window_expired(p_user_id integer, p_break_type break_type_enum, p_check_time timestamp with time zone DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql
AS $function$
      DECLARE
          break_config RECORD;
          current_server_time TIMESTAMP WITH TIME ZONE;
          break_end_time TIMESTAMP WITH TIME ZONE;
      BEGIN
          -- Always use server time for validation
          current_server_time := p_check_time;
          
          -- Get break configuration
          SELECT * INTO break_config
          FROM breaks
          WHERE user_id = p_user_id 
          AND break_type = p_break_type
          AND is_active = true
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No break configured
          END IF;
          
          -- Calculate break end time for the check date (Manila timezone)
          break_end_time := ((current_server_time AT TIME ZONE 'Asia/Manila')::DATE + break_config.end_time) AT TIME ZONE 'Asia/Manila';
          
          -- Check if current server time is past the break window
          RETURN current_server_time > break_end_time;
      END;
$function$;

COMMENT ON FUNCTION public.is_break_window_expired(integer, break_type_enum, timestamptz) 
    IS 'Checks if a break window has expired based on server time';

-- Function to mark expired breaks and create missed break sessions
CREATE OR REPLACE FUNCTION public.mark_expired_breaks(p_user_id integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
AS $function$
      DECLARE
          break_record RECORD;
          user_break RECORD;
          expired_count INTEGER := 0;
          missed_count INTEGER := 0;
      BEGIN
          -- First, mark existing break sessions as expired
          FOR break_record IN
              SELECT bs.id, bs.agent_user_id, bs.break_type, bs.break_date
              FROM break_sessions bs
              WHERE bs.is_expired = FALSE
              AND (p_user_id IS NULL OR bs.agent_user_id = p_user_id)
              AND bs.break_date = CURRENT_DATE
              AND is_break_window_expired(bs.agent_user_id, bs.break_type)
          LOOP
              -- Mark the break session as expired
              UPDATE break_sessions 
              SET is_expired = TRUE
              WHERE id = break_record.id;
              
              expired_count := expired_count + 1;
          END LOOP;
          
          -- Second, create missed break sessions for expired break windows
          FOR user_break IN
              SELECT DISTINCT b.user_id, b.break_type, b.start_time, b.end_time, b.duration_minutes
              FROM breaks b
              WHERE b.is_active = true
              AND (p_user_id IS NULL OR b.user_id = p_user_id)
              AND is_break_window_expired(b.user_id, b.break_type)
              AND NOT EXISTS (
                  -- Check if user already has a break session for this break type today
                  SELECT 1 FROM break_sessions bs2 
                  WHERE bs2.agent_user_id = b.user_id 
                  AND bs2.break_type = b.break_type 
                  AND bs2.break_date = CURRENT_DATE
              )
          LOOP
          -- Create a missed break session
          INSERT INTO break_sessions (
              agent_user_id, 
              break_type, 
              start_time, 
              end_time, 
              duration_minutes, 
              break_date, 
              is_expired,
              created_at
          ) VALUES (
              user_break.user_id,
              user_break.break_type,
              (CURRENT_DATE + user_break.start_time)::timestamp, -- Start time for today
              (CURRENT_DATE + user_break.start_time)::timestamp, -- End time = start time (no duration used)
              0, -- Duration is 0 because user didn't take the break
              CURRENT_DATE,
              TRUE, -- Mark as expired immediately
              NOW()
          );
              
              missed_count := missed_count + 1;
          END LOOP;
          
          RETURN expired_count + missed_count;
      END;
$function$;

COMMENT ON FUNCTION public.mark_expired_breaks(integer) 
    IS 'Marks expired break sessions as expired AND creates missed break sessions for expired break windows. Returns total count of processed breaks.';

-- Function to check if a specific break session is expired
CREATE OR REPLACE FUNCTION public.is_break_session_expired(p_session_id integer)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
      DECLARE
          session_record RECORD;
      BEGIN
          -- Get the break session
          SELECT bs.is_expired, bs.agent_user_id, bs.break_type, bs.break_date, bs.end_time
          INTO session_record
          FROM break_sessions bs
          WHERE bs.id = p_session_id;
          
          IF NOT FOUND THEN
              RETURN FALSE;
          END IF;
          
          -- If already marked as expired, return true
          IF session_record.is_expired THEN
              RETURN TRUE;
          END IF;
          
          -- Only check window expiration for incomplete sessions (no end_time)
          -- Completed sessions should not be marked as expired just because the window passed
          IF session_record.end_time IS NULL THEN
              -- Check if the break window expired on the session's date, not today
              RETURN is_break_window_expired(session_record.agent_user_id, session_record.break_type, 
                  (session_record.break_date + INTERVAL '23:59:59') AT TIME ZONE 'Asia/Manila');
          END IF;
          
          -- Completed sessions are not expired
          RETURN FALSE;
      END;
$function$;

COMMENT ON FUNCTION public.is_break_session_expired(integer) 
    IS 'Checks if a specific break session is expired';

-- =====================================================
-- REMOVE BREAK DURATION TRIGGER (NOT NEEDED)
-- =====================================================

-- Drop the calculate_break_duration trigger since it's not needed
-- The breaks table already has fixed durations for each break type
DROP TRIGGER IF EXISTS calculate_break_duration_trigger ON break_sessions;

-- Drop the calculate_break_duration function since it's not needed
DROP FUNCTION IF EXISTS public.calculate_break_duration();

COMMENT ON TABLE break_sessions 
    IS 'Break sessions now use fixed durations from breaks table - no automatic calculation needed';

-- =====================================================
-- FIX BREAK AVAILABILITY TO EXCLUDE MISSED BREAKS
-- =====================================================

-- Update get_agent_daily_breaks to only count actually used breaks, not missed ones
CREATE OR REPLACE FUNCTION public.get_agent_daily_breaks(p_agent_user_id integer)
RETURNS TABLE(break_type break_type_enum, break_count integer, total_minutes integer, can_take_break boolean)
LANGUAGE plpgsql
AS $function$
      BEGIN
          RETURN QUERY
          WITH break_types AS (
              SELECT unnest(enum_range(NULL::break_type_enum)) AS bt
          ),
          today_breaks AS (
              SELECT 
                  bs.break_type,
                  COUNT(*) as break_count,
                  COALESCE(SUM(bs.duration_minutes), 0) as total_minutes
              FROM public.break_sessions bs
              WHERE bs.agent_user_id = p_agent_user_id
              AND bs.break_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
              AND bs.end_time IS NOT NULL
              AND bs.is_expired = FALSE  -- Only count actually used breaks, not missed ones
              GROUP BY bs.break_type
          )
          SELECT 
              bt.bt as break_type,
              COALESCE(tb.break_count, 0)::INTEGER as break_count,
              COALESCE(tb.total_minutes, 0)::INTEGER as total_minutes,
              (COALESCE(tb.break_count, 0) = 0) as can_take_break
          FROM break_types bt
          LEFT JOIN today_breaks tb ON bt.bt = tb.break_type
          ORDER BY bt.bt;
      END;
$function$;

COMMENT ON FUNCTION public.get_agent_daily_breaks(integer) 
    IS 'UPDATED: Only counts actually used breaks (is_expired = FALSE), not missed break sessions';

-- =====================================================
-- SUMMARY
-- =====================================================
-- Updated functions now ONLY use custom break settings from breaks table:
-- 1. calculate_break_windows() - Returns only custom breaks from breaks table
-- 2. is_break_available_now() - Uses only custom break windows
-- 3. is_break_available_soon() - Uses only custom break windows  
-- 4. is_break_missed() - Uses only custom break windows
-- 5. is_break_window_ending_soon() - Uses only custom break windows
-- 6. is_break_available_now_notification_sent() - Uses only custom break windows
-- 7. is_break_window_expired() - Checks if break window has expired
-- 8. mark_expired_breaks() - Marks expired break sessions
-- 9. is_break_session_expired() - Checks if specific session is expired
-- 
-- All functions now require users to configure their own break schedules!
-- No default break windows are provided - every user must set custom breaks.
