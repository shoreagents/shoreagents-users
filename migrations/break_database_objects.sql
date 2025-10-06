-- =====================================================
-- BREAK-RELATED DATABASE OBJECTS FROM FULL.SQL
-- =====================================================
-- This file contains all break-related tables, functions, triggers, 
-- indexes, and other database objects found in migrations/full.sql
-- =====================================================

-- =====================================================
-- 1. ENUMS
-- =====================================================

-- Break type enumeration
CREATE TYPE public."break_type_enum" AS ENUM (
    'Morning',
    'Lunch',
    'Afternoon',
    'NightFirst',
    'NightMeal',
    'NightSecond'
);

-- =====================================================
-- 2. TABLES
-- =====================================================

-- Main break sessions table
CREATE TABLE public.break_sessions (
    id serial4 NOT NULL,
    agent_user_id int4 NOT NULL,
    start_time timestamptz NOT NULL,
    end_time timestamptz NULL,
    break_date date NOT NULL,
    pause_time timestamptz NULL,
    resume_time timestamptz NULL,
    created_at timestamptz DEFAULT now() NULL,
    updated_at timestamptz DEFAULT now() NULL,
    break_type public."break_type_enum" NOT NULL,
    duration_minutes int4 NULL,
    pause_used bool DEFAULT false NULL,
    CONSTRAINT break_sessions_break_type_check CHECK ((break_type = ANY (ARRAY['Morning'::break_type_enum, 'Lunch'::break_type_enum, 'Afternoon'::break_type_enum, 'NightFirst'::break_type_enum, 'NightMeal'::break_type_enum, 'NightSecond'::break_type_enum]))),
    CONSTRAINT break_sessions_pkey PRIMARY KEY (id)
);

-- =====================================================
-- 3. INDEXES
-- =====================================================

CREATE INDEX idx_break_sessions_agent_user_id ON public.break_sessions USING btree (agent_user_id);
CREATE INDEX idx_break_sessions_break_date ON public.break_sessions USING btree (break_date);
CREATE INDEX idx_break_sessions_break_type ON public.break_sessions USING btree (break_type);

-- =====================================================
-- 4. TRIGGERS
-- =====================================================

-- Update timestamp trigger
CREATE TRIGGER update_break_sessions_updated_at 
    BEFORE UPDATE ON public.break_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Calculate break duration trigger
CREATE TRIGGER calculate_break_duration_trigger 
    BEFORE INSERT OR UPDATE ON public.break_sessions 
    FOR EACH ROW EXECUTE FUNCTION calculate_break_duration();

COMMENT ON TRIGGER calculate_break_duration_trigger ON public.break_sessions 
    IS 'Automatically calculates duration_minutes when end_time is set, handling paused breaks correctly';

-- =====================================================
-- 5. FUNCTIONS
-- =====================================================

-- Calculate break duration function
CREATE OR REPLACE FUNCTION public.calculate_break_duration()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- If end_time is being set and start_time exists, calculate duration
    IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
        -- If break was paused, calculate based on pause state
        IF NEW.pause_time IS NOT NULL THEN
            -- If break was resumed, use normal pause calculation
            IF NEW.resume_time IS NOT NULL THEN
                -- Total duration = (pause_time - start_time) + (end_time - resume_time)
                NEW.duration_minutes = EXTRACT(EPOCH FROM (
                    (NEW.pause_time - NEW.start_time) + 
                    (NEW.end_time - NEW.resume_time)
                )) / 60;
            ELSE
                -- Break was paused but never resumed (auto-ended)
                -- Use the time from start to pause as the actual break duration
                NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.pause_time - NEW.start_time)) / 60;
            END IF;
        ELSE
            -- Normal calculation for non-paused breaks
            NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.calculate_break_duration() 
    IS 'Calculates break duration in minutes. For paused breaks that are auto-ended, uses time from start to pause as the actual break duration.';

-- Calculate break windows function
CREATE OR REPLACE FUNCTION public.calculate_break_windows(p_user_id integer)
RETURNS TABLE(break_type break_type_enum, start_time time without time zone, end_time time without time zone)
LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
      BEGIN
          -- Get shift information for the user
          SELECT ji.shift_period, ji.shift_schedule, ji.shift_time
          INTO shift_info
          FROM job_info ji
          LEFT JOIN agents a ON ji.agent_user_id = a.user_id
          WHERE (ji.agent_user_id = p_user_id OR ji.internal_user_id = p_user_id)
          AND ji.shift_time IS NOT NULL
          LIMIT 1;
          
          -- If no shift info found, return empty
          IF NOT FOUND THEN
              RETURN;
          END IF;
          
          -- Parse shift time to get start and end times
          shift_start_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '%AM' AND split_part(split_part(shift_info.shift_time, ' - ', 1), ':', 1) = '12' THEN
                  '00' || ':' || split_part(split_part(shift_info.shift_time, ' - ', 1), ':', 2)
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '%PM' AND split_part(split_part(shift_info.shift_time, ' - ', 1), ':', 1) != '12' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 1), ':', 1)::INTEGER + 12)::TEXT || ':' || split_part(split_part(shift_info.shift_time, ' - ', 1), ':', 2)
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 1), ':', 1) || ':' || split_part(split_part(shift_info.shift_time, ' - ', 1), ':', 2)
          END::TIME;
          
          shift_end_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '%AM' AND split_part(split_part(shift_info.shift_time, ' - ', 2), ':', 1) = '12' THEN
                  '00' || ':' || split_part(split_part(shift_info.shift_time, ' - ', 2), ':', 2)
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '%PM' AND split_part(split_part(shift_info.shift_time, ' - ', 2), ':', 1) != '12' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ':', 1)::INTEGER + 12)::TEXT || ':' || split_part(split_part(shift_info.shift_time, ' - ', 2), ':', 2)
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 2), ':', 1) || ':' || split_part(split_part(shift_info.shift_time, ' - ', 2), ':', 2)
          END::TIME;
          
          -- Determine if it's a night shift
          is_night_shift := shift_start_time > shift_end_time;
          
          -- Return break windows based on shift start time
          -- Morning/First Night break: 2 hours after shift start
          RETURN QUERY SELECT 
              CASE 
                  WHEN shift_info.shift_period = 'Day Shift' THEN 'Morning'::break_type_enum
                  ELSE 'NightFirst'::break_type_enum
              END,
              shift_start_time + INTERVAL '2 hours',
              shift_start_time + INTERVAL '3 hours';
          
          -- Lunch/Night Meal break: 4 hours after shift start
          RETURN QUERY SELECT 
              CASE 
                  WHEN shift_info.shift_period = 'Day Shift' THEN 'Lunch'::break_type_enum
                  ELSE 'NightMeal'::break_type_enum
              END,
              shift_start_time + INTERVAL '4 hours',
              shift_start_time + INTERVAL '7 hours';
          
          -- Afternoon/Second Night break: 7 hours 45 minutes after shift start
          RETURN QUERY SELECT 
              CASE 
                  WHEN shift_info.shift_period = 'Day Shift' THEN 'Afternoon'::break_type_enum
                  ELSE 'NightSecond'::break_type_enum
              END,
              shift_start_time + INTERVAL '7 hours 45 minutes',
              shift_start_time + INTERVAL '8 hours 45 minutes';
      END;
      $function$;

COMMENT ON FUNCTION public.calculate_break_windows(int4) 
    IS 'Calculates break windows based on agent shift times (force cleaned)';

-- Check if agent can take break function
CREATE OR REPLACE FUNCTION public.can_agent_take_break(p_agent_user_id integer, p_break_type break_type_enum)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
        DECLARE
            break_count INTEGER;
        BEGIN
            -- Check if agent has already used this break type today
            SELECT COUNT(*)
            INTO break_count
            FROM public.break_sessions
            WHERE agent_user_id = p_agent_user_id
            AND break_type = p_break_type
            AND break_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
            AND end_time IS NOT NULL; -- Only count completed breaks
            
            -- Each break type can only be used once per day
            RETURN break_count = 0;
        END;
        $function$;

-- Check break reminders function
CREATE OR REPLACE FUNCTION public.check_break_reminders()
RETURNS integer
LANGUAGE plpgsql
AS $function$
            DECLARE
                agent_record RECORD;
                check_time TIMESTAMP WITH TIME ZONE := NOW() AT TIME ZONE 'Asia/Manila';
                notifications_sent INTEGER := 0;
            BEGIN
                -- NOTE: Task notifications are now handled by a separate scheduler
                -- This function only handles break-related notifications

                -- Loop through all active agents
                FOR agent_record IN
                    SELECT u.user_id
                    FROM users u
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
            $function$;

-- Create break reminder notification function
CREATE OR REPLACE FUNCTION public.create_break_reminder_notification(p_agent_user_id integer, p_notification_type text, p_break_type break_type_enum DEFAULT NULL::break_type_enum)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    notif_category TEXT := 'break';
    title_text TEXT;
    message_text TEXT;
    break_name TEXT;
BEGIN
    -- Determine break name based on break type
    CASE p_break_type
        WHEN 'Morning' THEN break_name := 'Morning Break';
        WHEN 'Lunch' THEN break_name := 'Lunch Break';
        WHEN 'Afternoon' THEN break_name := 'Afternoon Break';
        WHEN 'NightFirst' THEN break_name := 'First Night Break';
        WHEN 'NightMeal' THEN break_name := 'Night Meal Break';
        WHEN 'NightSecond' THEN break_name := 'Second Night Break';
        ELSE break_name := 'Break';
    END CASE;

    -- Create notification based on type
    CASE p_notification_type
        WHEN 'available_soon' THEN
            title_text := break_name || ' Available Soon';
            message_text := 'Your ' || break_name || ' will be available in 15 minutes.';
        WHEN 'available_now' THEN
            title_text := break_name || ' Available Now';
            message_text := 'Your ' || break_name || ' is now available! You can take it now.';
        WHEN 'missed_break' THEN
            title_text := 'Missed ' || break_name;
            message_text := 'You have not taken your ' || break_name || ' yet! Please take it soon.';
        WHEN 'ending_soon' THEN
            title_text := break_name || ' Window Ending Soon';
            message_text := 'Your ' || break_name || ' window will end in 15 minutes. Take it now if you need it.';
        ELSE
            title_text := 'Break Reminder';
            message_text := 'Break reminder notification.';
    END CASE;

    -- Insert notification
    INSERT INTO notifications (
        user_id,
        title,
        message,
        category,
        priority,
        payload
    ) VALUES (
        p_agent_user_id,
        title_text,
        message_text,
        notif_category,
        'medium',
        jsonb_build_object(
            'break_type', p_break_type,
            'notification_type', p_notification_type,
            'timestamp', NOW()
        )
    );
END;
$function$;

-- =====================================================
-- 6. ADDITIONAL BREAK-RELATED FUNCTIONS
-- =====================================================

-- Get agent shift information function
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

COMMENT ON FUNCTION public.get_agent_shift_info(int4) 
    IS 'Gets agent shift information from job_info table with fallback defaults';

-- Check if break is available function
CREATE OR REPLACE FUNCTION public.is_break_available(p_agent_user_id integer, p_break_type break_type_enum, p_current_time timestamp without time zone DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text))
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

COMMENT ON FUNCTION public.is_break_available(int4, break_type_enum, timestamp) 
    IS 'Fixed: Returns false for users without shift times';

-- Check if break is available now function
CREATE OR REPLACE FUNCTION public.is_break_available_now(p_agent_user_id integer, p_break_type break_type_enum, p_current_time timestamp without time zone DEFAULT NULL::timestamp without time zone)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_start_time TIME;
          break_end_time TIME;
          break_already_taken BOOLEAN;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE; -- No shift configured
          END IF;
          
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
          
          -- Get break window from calculate_break_windows
          SELECT start_time, end_time INTO break_start_time, break_end_time
          FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No break window for this type
          END IF;
          
          -- Check if current time is within the break window
          RETURN current_time_only >= break_start_time AND current_time_only < break_end_time;
      END;
      $function$;

-- Check if "available now" notification was already sent
CREATE OR REPLACE FUNCTION public.is_break_available_now_notification_sent(p_agent_user_id integer, p_break_type break_type_enum, p_check_time timestamp without time zone)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    break_start_time TIMESTAMP;
    break_end_time TIMESTAMP;
    notification_exists BOOLEAN;
BEGIN
    -- Get the break window for the current day
    SELECT 
        (CURRENT_DATE + (SPLIT_PART(ji.shift_time, ' - ', 1))::time) AT TIME ZONE 'Asia/Manila' INTO break_start_time
    FROM job_info ji 
    WHERE ji.agent_user_id = p_agent_user_id;
    
    IF break_start_time IS NULL THEN
        RETURN FALSE; -- No shift configured
    END IF;
    
    -- Calculate break start time based on break type
    CASE p_break_type
        WHEN 'Lunch' THEN
            break_start_time := break_start_time + INTERVAL '4 hours'; -- 4 hours after shift start
            break_end_time := break_start_time + INTERVAL '1 hour'; -- 1 hour break
        WHEN 'Morning' THEN
            break_start_time := break_start_time + INTERVAL '2 hours'; -- 2 hours after shift start
            break_end_time := break_start_time + INTERVAL '15 minutes'; -- 15 minute break
        WHEN 'Afternoon' THEN
            break_start_time := break_start_time + INTERVAL '6 hours'; -- 6 hours after shift start
            break_end_time := break_start_time + INTERVAL '15 minutes'; -- 15 minute break
        ELSE
            RETURN FALSE; -- Unknown break type
    END CASE;
    
    -- Check if "available_now" notification was already sent for this break period today
    -- We check for notifications sent today, not just within the current break window
    SELECT EXISTS(
        SELECT 1 FROM notifications 
        WHERE user_id = p_agent_user_id 
        AND category = 'break'
        AND payload->>'reminder_type' = 'available_now'
        AND payload->>'break_type' = p_break_type::text
        AND DATE(created_at AT TIME ZONE 'Asia/Manila') = CURRENT_DATE
    ) INTO notification_exists;
    
    RETURN notification_exists;
END;
$function$;

COMMENT ON FUNCTION public.is_break_available_now_notification_sent(int4, break_type_enum, timestamp) 
    IS 'Checks if "available_now" notification was already sent for current break period';

-- Check if break is available soon (15 minutes before)
CREATE OR REPLACE FUNCTION public.is_break_available_soon(p_agent_user_id integer, p_break_type break_type_enum, p_current_time timestamp without time zone DEFAULT NULL::timestamp without time zone)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_start_time TIME;
          minutes_until_break INTEGER;
          break_already_taken BOOLEAN;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE; -- No shift configured
          END IF;
          
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
          
          -- Get break start time from calculate_break_windows
          SELECT start_time INTO break_start_time
          FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No break window for this type
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

-- Check if break was missed (30 minutes after available)
CREATE OR REPLACE FUNCTION public.is_break_missed(p_agent_user_id integer, p_break_type break_type_enum, p_current_time timestamp without time zone DEFAULT NULL::timestamp without time zone)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_start_time TIME;
          break_end_time TIME;
          minutes_since_break_start INTEGER;
          break_already_taken BOOLEAN;
          break_currently_active BOOLEAN;  -- NEW: Check for currently active breaks
          current_date_manila DATE;
          last_notification_time TIMESTAMP;
          minutes_since_last_notification INTEGER;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE; -- No shift configured
          END IF;
          
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time;
          END IF;
          
          current_time_only := current_time_manila::TIME;
          current_date_manila := current_time_manila::DATE;
          
          -- NEW: Check if break is currently active (being used right now)
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = current_date_manila
              AND end_time IS NULL  -- Currently active break
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
          
          -- Get break window from calculate_break_windows
          SELECT start_time, end_time INTO break_start_time, break_end_time
          FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No break window for this type
          END IF;
          
          -- Check if we're within the break window
          IF current_time_only < break_start_time OR current_time_only >= break_end_time THEN
              RETURN FALSE; -- Outside break window
          END IF;
          
          -- Calculate minutes since break start
          minutes_since_break_start := EXTRACT(EPOCH FROM (current_time_only - break_start_time)) / 60;
          
          -- Check if it's been at least 30 minutes since break start
          IF minutes_since_break_start < 30 THEN
              RETURN FALSE; -- Too early to send reminder
          END IF;
          
          -- Check if we've already sent a missed break notification recently (within last 30 minutes)
          SELECT MAX(created_at) INTO last_notification_time
          FROM notifications
          WHERE user_id = p_agent_user_id
          AND category = 'break'
          AND payload->>'break_type' = p_break_type::text
          AND payload->>'notification_type' = 'missed_break'
          AND created_at >= current_time_manila - INTERVAL '1 hour';
          
          IF last_notification_time IS NOT NULL THEN
              minutes_since_last_notification := EXTRACT(EPOCH FROM (current_time_manila - last_notification_time)) / 60;
              IF minutes_since_last_notification < 30 THEN
                  RETURN FALSE; -- Already sent notification recently
              END IF;
          END IF;
          
          RETURN TRUE; -- Break is missed and notification should be sent
      END;
      $function$;

-- Check if break window is ending soon (15 minutes before expiry)
CREATE OR REPLACE FUNCTION public.is_break_window_ending_soon(p_agent_user_id integer, p_break_type break_type_enum, p_check_time timestamp with time zone DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql
AS $function$
      DECLARE
          shift_info RECORD;
          break_windows RECORD;
          current_time_only TIME;
          break_end_time TIME;
          minutes_until_expiry INTEGER;
          break_already_taken BOOLEAN;
          break_currently_active BOOLEAN;  -- NEW: Check for currently active breaks
      BEGIN
          -- Get agent shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE;
          END IF;
          
          -- NEW: Check if break is currently active (being used right now)
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = (p_check_time AT TIME ZONE 'Asia/Manila')::DATE
              AND end_time IS NULL  -- Currently active break
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
          
          -- Get break windows using user_id
          SELECT * INTO break_windows FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE;
          END IF;
          
          -- SIMPLE APPROACH: Extract time part directly from input timestamp
          -- Treat the input as local time (Manila time)
          current_time_only := p_check_time::TIME;
          break_end_time := break_windows.end_time;
          
          -- Calculate minutes until break window expires
          IF current_time_only > break_end_time THEN
              -- Current time is after break end time, so it's already ended
              minutes_until_expiry := 0;
          ELSE
              -- Calculate minutes until end
              minutes_until_expiry := EXTRACT(EPOCH FROM (break_end_time - current_time_only)) / 60;
          END IF;
          
          -- Return true if break window is ending in 15 minutes (with 1-minute tolerance)
          -- This means between 14-16 minutes before the end (narrower, more precise window)
          RETURN (minutes_until_expiry >= 14 AND minutes_until_expiry <= 16);
      END;
      $function$;

COMMENT ON FUNCTION public.is_break_window_ending_soon(int4, break_type_enum, timestamptz) 
    IS 'FIXED: Now excludes currently active breaks from break window ending soon notifications. Users will not receive "break ending soon" notifications while they are currently on break.';

-- Get agent daily breaks function
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

-- Reset daily breaks function
CREATE OR REPLACE FUNCTION public.reset_daily_breaks()
RETURNS integer
LANGUAGE plpgsql
AS $function$
			DECLARE
				reset_count INTEGER := 0;
			BEGIN
				-- This function doesn't delete data, it just ensures that break usage
				-- is calculated based on today's date only
				
				-- Count how many agents would be affected (for logging purposes)
				SELECT COUNT(DISTINCT agent_user_id) 
				INTO reset_count
				FROM public.break_sessions 
				WHERE break_date = (NOW() AT TIME ZONE 'Asia/Manila')::date;
				
				-- The reset is implicit - break availability is checked by querying
				-- only today's break_sessions records
				
				RETURN reset_count;
			END;
			$function$;

-- Check if agent breaks should be reset
CREATE OR REPLACE FUNCTION public.should_reset_agent_breaks(p_agent_user_id integer)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    last_reset_date DATE;
    current_local_date DATE;
BEGIN
    -- Get current date in Philippines timezone
    current_local_date := (NOW() AT TIME ZONE 'Asia/Manila')::date;
    
    -- Get the latest break_date for this agent
    SELECT MAX(break_date) INTO last_reset_date
    FROM break_sessions
    WHERE agent_user_id = p_agent_user_id;
    
    -- If no breaks exist or last break was before today, reset is needed
    RETURN (last_reset_date IS NULL OR last_reset_date < current_local_date);
END;
$function$;

-- Trigger break availability check function
CREATE OR REPLACE FUNCTION public.trigger_break_availability_check()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
    PERFORM check_break_availability();
END;
$function$;

-- Create break status notification trigger function
CREATE OR REPLACE FUNCTION public.create_break_status_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  title_text text;
  message_text text;
  notif_type text := 'info';
BEGIN
  IF TG_OP = 'INSERT' THEN
    title_text := 'Break started';
    message_text := format('%s break started', NEW.break_type);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.end_time IS NOT NULL AND (OLD.end_time IS NULL OR NEW.end_time <> OLD.end_time) THEN
      title_text := 'Break ended';
      message_text := format('%s break completed (%s min)', NEW.break_type, COALESCE(NEW.duration_minutes, 0));
      notif_type := 'success';
    ELSIF NEW.pause_time IS NOT NULL AND (OLD.pause_time IS DISTINCT FROM NEW.pause_time) THEN
      title_text := 'Break paused';
      message_text := format('%s break paused', NEW.break_type);
      notif_type := 'warning';
    ELSIF NEW.resume_time IS NOT NULL AND (OLD.resume_time IS DISTINCT FROM NEW.resume_time) THEN
      title_text := 'Break resumed';
      message_text := format('%s break resumed', NEW.break_type);
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, category, type, title, message, payload)
  VALUES (
    NEW.agent_user_id,
    'break',
    notif_type,
    title_text,
    message_text,
    json_build_object('break_type', NEW.break_type, 'break_session_id', NEW.id, 'break_date', NEW.break_date, 'action_url', '/status/breaks')
  );
  RETURN NEW;
END;
$function$;

-- Get local break date function
CREATE OR REPLACE FUNCTION public.get_local_break_date(p_timezone text DEFAULT 'Asia/Manila'::text)
RETURNS date
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE p_timezone)::DATE;
END;
$function$;

-- =====================================================
-- 7. SUMMARY
-- =====================================================

-- BREAK-RELATED OBJECTS FOUND:
-- - 1 ENUM: break_type_enum
-- - 1 TABLE: break_sessions
-- - 3 INDEXES: on break_sessions table
-- - 2 TRIGGERS: update_break_sessions_updated_at, calculate_break_duration_trigger
-- - 20+ FUNCTIONS: Complete break management and notification system

-- CORE BREAK FUNCTIONS:
-- - get_agent_shift_info(): Gets agent shift information from job_info table
-- - calculate_break_windows(): Calculates break windows based on shift times
-- - can_agent_take_break(): Checks if agent can take a specific break type
-- - get_agent_daily_breaks(): Returns daily break statistics for an agent

-- BREAK AVAILABILITY FUNCTIONS:
-- - is_break_available(): Checks if break is available at exact start time
-- - is_break_available_now(): Checks if break is currently available (within window)
-- - is_break_available_soon(): Checks if break becomes available in 15 minutes
-- - is_break_missed(): Checks if break was missed (30+ minutes after available)
-- - is_break_window_ending_soon(): Checks if break window ends in 15 minutes

-- NOTIFICATION FUNCTIONS:
-- - check_break_reminders(): Main function that checks all agents for break notifications
-- - create_break_reminder_notification(): Creates break reminder notifications
-- - is_break_available_now_notification_sent(): Prevents duplicate "available now" notifications
-- - create_break_status_notification(): Trigger function for break status notifications

-- DAILY RESET FUNCTIONS:
-- - reset_daily_breaks(): Resets daily break availability (implicit)
-- - should_reset_agent_breaks(): Checks if agent breaks need reset
-- - get_local_break_date(): Gets local date for break tracking

-- UTILITY FUNCTIONS:
-- - calculate_break_duration(): Automatically calculates break duration
-- - trigger_break_availability_check(): Triggers break availability check

-- NOTIFICATION TYPES SUPPORTED:
-- - available_soon: 15 minutes before break becomes available
-- - available_now: When break window opens
-- - missed_break: 30 minutes after break becomes available (if not taken)
-- - ending_soon: 15 minutes before break window expires

-- The break system supports:
-- - 6 break types: Morning, Lunch, Afternoon, NightFirst, NightMeal, NightSecond
-- - Automatic duration calculation with pause/resume support
-- - Break availability checking based on shift times
-- - Comprehensive notification system for break reminders
-- - Daily break reset functionality
-- - Break window calculations relative to shift start times
-- - Duplicate notification prevention
-- - Night shift support with proper time handling
-- - Timezone-aware calculations (Asia/Manila)
