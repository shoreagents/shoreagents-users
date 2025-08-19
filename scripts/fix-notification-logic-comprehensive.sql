-- Fix the notification messages with comprehensive logic for ALL break types
-- This supports day shifts (Morning, Lunch, Afternoon) and night shifts (NightFirst, NightMeal, NightSecond)
-- Provides user-friendly break names and accurate timing

CREATE OR REPLACE FUNCTION public.create_break_reminder_notification(
    p_agent_user_id integer,
    p_notification_type text,
    p_break_type break_type_enum DEFAULT NULL::break_type_enum
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    title_text TEXT;
    message_text TEXT;
    notif_type TEXT;
    notif_category TEXT;
    payload_data JSONB;
    existing_notification_id INTEGER;
    minutes_remaining INTEGER;
    break_type_name TEXT;
    user_friendly_name TEXT;
    shift_info RECORD;
    break_windows RECORD;
    current_time_val TIMESTAMP;
    break_end_time TIME;
    current_time_only TIME;
BEGIN
    notif_category := 'break';
    current_time_val := NOW() AT TIME ZONE 'Asia/Manila';
    current_time_only := current_time_val::TIME;

    -- Check if a similar notification was created in the last 5 minutes
    -- This prevents duplicate notifications from multiple function calls
    SELECT id INTO existing_notification_id
    FROM notifications
    WHERE user_id = p_agent_user_id
    AND category = notif_category
    AND created_at > (NOW() - INTERVAL '5 minutes')
    AND (
        (p_notification_type = 'available_soon' AND payload->>'reminder_type' = 'available_soon' AND payload->>'break_type' = p_break_type::text)
        OR (p_notification_type = 'break_available' AND payload->>'reminder_type' = 'break_available' AND payload->>'break_type' = p_break_type::text)
        OR (p_notification_type = 'missed_break' AND payload->>'reminder_type' = 'missed_break' AND payload->>'break_type' = p_break_type::text)
        OR (p_notification_type = 'ending_soon' AND payload->>'reminder_type' = 'ending_soon')
    );

    -- If a similar notification exists, don't create another one
    IF existing_notification_id IS NOT NULL THEN
        RETURN;
    END IF;

    IF p_notification_type = 'available_soon' THEN
        -- Get user-friendly name for the break type
        user_friendly_name := CASE p_break_type
            WHEN 'Morning' THEN 'Morning'
            WHEN 'Lunch' THEN 'Lunch'
            WHEN 'Afternoon' THEN 'Afternoon'
            WHEN 'NightFirst' THEN 'First Night'
            WHEN 'NightMeal' THEN 'Night Meal'
            WHEN 'NightSecond' THEN 'Second Night'
            ELSE p_break_type::text
        END;
        
        title_text := format('%s break available soon', user_friendly_name);
        message_text := format('Your %s break will be available in 15 minutes', user_friendly_name);
        notif_type := 'info';
        payload_data := jsonb_build_object('reminder_type', 'available_soon', 'break_type', p_break_type, 'action_url', '/status/breaks');

    ELSIF p_notification_type = 'break_available' THEN
        -- Get user-friendly name for the break type
        user_friendly_name := CASE p_break_type
            WHEN 'Morning' THEN 'Morning'
            WHEN 'Lunch' THEN 'Lunch'
            WHEN 'Afternoon' THEN 'Afternoon'
            WHEN 'NightFirst' THEN 'First Night'
            WHEN 'NightMeal' THEN 'Night Meal'
            WHEN 'NightSecond' THEN 'Second Night'
            ELSE p_break_type::text
        END;
        
        title_text := format('%s break available now', user_friendly_name);
        message_text := format('Your %s break is now available!', user_friendly_name);
        notif_type := 'success';
        payload_data := jsonb_build_object('reminder_type', 'break_available', 'break_type', p_break_type, 'action_url', '/status/breaks');

    ELSIF p_notification_type = 'missed_break' THEN
        -- Get user-friendly name for the break type
        user_friendly_name := CASE p_break_type
            WHEN 'Morning' THEN 'Morning'
            WHEN 'Lunch' THEN 'Lunch'
            WHEN 'Afternoon' THEN 'Afternoon'
            WHEN 'NightFirst' THEN 'First Night'
            WHEN 'NightMeal' THEN 'Night Meal'
            WHEN 'NightSecond' THEN 'Second Night'
            ELSE p_break_type::text
        END;
        
        title_text := format('%s break missed', user_friendly_name);
        message_text := format('You have not taken your %s break yet!', user_friendly_name);
        notif_type := 'warning';
        payload_data := jsonb_build_object('reminder_type', 'missed_break', 'break_type', p_break_type, 'action_url', '/status/breaks');

    ELSIF p_notification_type = 'ending_soon' THEN
        -- Calculate actual minutes remaining and get break type name
        minutes_remaining := 0;
        break_type_name := 'break';
        user_friendly_name := 'break';

        -- Get agent shift information to determine which break is ending
        SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;

        IF FOUND AND shift_info.shift_time IS NOT NULL THEN
            -- Get break windows for this shift
            SELECT * INTO break_windows FROM calculate_break_windows(shift_info.shift_time) LIMIT 1;

            IF FOUND THEN
                -- Determine which break window is ending soon by checking each one
                -- Morning break ending soon?
                IF current_time_only >= (break_windows.morning_end - INTERVAL '15 minutes')::TIME
                   AND current_time_only < break_windows.morning_end::TIME THEN
                    break_type_name := 'Morning';
                    break_end_time := break_windows.morning_end;
                    user_friendly_name := 'Morning';
                -- Lunch break ending soon?
                ELSIF current_time_only >= (break_windows.lunch_end - INTERVAL '15 minutes')::TIME
                      AND current_time_only < break_windows.lunch_end::TIME THEN
                    break_type_name := 'Lunch';
                    break_end_time := break_windows.lunch_end;
                    user_friendly_name := 'Lunch';
                -- Afternoon break ending soon?
                ELSIF current_time_only >= (break_windows.afternoon_end - INTERVAL '15 minutes')::TIME
                      AND current_time_only < break_windows.afternoon_end::TIME THEN
                    break_type_name := 'Afternoon';
                    break_end_time := break_windows.afternoon_end;
                    user_friendly_name := 'Afternoon';
                END IF;

                -- Calculate actual minutes remaining
                IF break_end_time IS NOT NULL THEN
                    minutes_remaining := EXTRACT(EPOCH FROM (break_end_time - current_time_only)) / 60;
                    IF minutes_remaining < 0 THEN
                        minutes_remaining := 0;
                    END IF;
                END IF;
            END IF;
        END IF;

        -- Create dynamic message based on actual minutes remaining
        IF minutes_remaining > 0 THEN
            title_text := format('%s break ending soon', user_friendly_name);
            message_text := format('Your %s break will end in %s minutes', user_friendly_name, minutes_remaining::text);
        ELSE
            title_text := format('%s break ending soon', user_friendly_name);
            message_text := format('Your %s break will end soon', user_friendly_name);
        END IF;

        notif_type := 'warning';
        payload_data := jsonb_build_object('reminder_type', 'ending_soon', 'break_type', break_type_name, 'minutes_remaining', minutes_remaining, 'action_url', '/status/breaks');
    ELSE
        RETURN;
    END IF;

    INSERT INTO notifications (user_id, category, type, title, message, payload)
    VALUES (p_agent_user_id, notif_category, notif_type, title_text, message_text, payload_data);
END;
$function$;
