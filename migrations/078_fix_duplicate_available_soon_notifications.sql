-- Migration 078: Fix duplicate "available soon" notifications
-- The issue is that the duplicate prevention logic has timezone mismatches
-- and the 15-minute cooldown is not working correctly

-- Update the create_break_reminder_notification function to fix duplicate prevention
CREATE OR REPLACE FUNCTION public.create_break_reminder_notification(
    p_agent_user_id integer, 
    p_notification_type text, 
    p_break_type break_type_enum DEFAULT NULL::break_type_enum
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    notif_category TEXT := 'break';
    notif_type TEXT := 'info';
    title_text TEXT;
    message_text TEXT;
    payload_data JSONB;
    break_name TEXT;
    current_time_manila TIMESTAMP;
    last_notification_time TIMESTAMP;
    minutes_since_last_notification INTEGER;
    detected_break_type break_type_enum;
    duplicate_exists BOOLEAN;
BEGIN
    -- Get current Manila time for logic calculations
    current_time_manila := NOW() AT TIME ZONE 'Asia/Manila';

    -- For ending_soon, detect the current break type based on time and break windows
    IF p_notification_type = 'ending_soon' AND p_break_type IS NULL THEN
        -- Find which break window is ending soon by checking all break windows
        SELECT bw.break_type INTO detected_break_type
        FROM calculate_break_windows(p_agent_user_id) bw
        WHERE bw.end_time > (current_time_manila::TIME - INTERVAL '17 minutes')
        AND bw.end_time <= (current_time_manila::TIME + INTERVAL '2 minutes')
        ORDER BY bw.end_time ASC
        LIMIT 1;
        
        -- If we found a break window ending soon, use it
        IF detected_break_type IS NOT NULL THEN
            p_break_type := detected_break_type;
        END IF;
    END IF;

    -- Determine break name for display
    break_name := CASE p_break_type
        WHEN 'Morning' THEN 'Morning break'
        WHEN 'Lunch' THEN 'Lunch break'
        WHEN 'Afternoon' THEN 'Afternoon break'
        WHEN 'NightFirst' THEN 'First night break'
        WHEN 'NightMeal' THEN 'Night meal break'
        WHEN 'NightSecond' THEN 'Second night break'
        ELSE 'Break'
    END;

    -- Set notification content based on type
    IF p_notification_type = 'available_soon' THEN
        title_text := break_name || ' available soon';
        message_text := 'Your ' || break_name || ' will be available in 15 minutes';
        notif_type := 'info';
        payload_data := jsonb_build_object(
            'reminder_type', 'available_soon',
            'break_type', p_break_type,
            'action_url', '/status/breaks'
        );
    ELSIF p_notification_type = 'available_now' THEN
        title_text := break_name || ' is now available';
        message_text := 'Your ' || break_name || ' is now available! You can take it now.';
        notif_type := 'success';
        payload_data := jsonb_build_object(
            'reminder_type', 'available_now',
            'break_type', p_break_type,
            'action_url', '/status/breaks'
        );
    ELSIF p_notification_type = 'ending_soon' THEN
        title_text := break_name || ' ending soon';
        message_text := 'Your ' || break_name || ' will end soon';
        notif_type := 'warning';
        payload_data := jsonb_build_object(
            'reminder_type', 'ending_soon',
            'break_type', p_break_type,
            'action_url', '/status/breaks'
        );
    ELSIF p_notification_type = 'missed_break' THEN
        title_text := 'You have not taken your ' || break_name || ' yet!';
        message_text := 'Your ' || break_name || ' was available but you haven''t taken it yet. Please take your break soon.';
        notif_type := 'warning';
        payload_data := jsonb_build_object(
            'reminder_type', 'missed_break',
            'break_type', p_break_type,
            'action_url', '/status/breaks'
        );
    ELSE
        RETURN; -- Invalid notification type
    END IF;

    -- FIXED: Enhanced duplicate prevention logic with proper timezone handling
    -- For available_soon notifications, check if we already sent one today for this break type
    IF p_notification_type = 'available_soon' THEN
        -- Check if we already sent an "available_soon" notification today for this break type
        SELECT EXISTS(
            SELECT 1 FROM notifications
            WHERE user_id = p_agent_user_id
            AND category = notif_category
            AND payload->>'reminder_type' = 'available_soon'
            AND payload->>'break_type' = p_break_type::text
            AND DATE(created_at AT TIME ZONE 'Asia/Manila') = current_time_manila::DATE
        ) INTO duplicate_exists;
        
        IF duplicate_exists THEN
            RETURN; -- Already sent today, don't send again
        END IF;
    ELSE
        -- For other notification types, use the existing cooldown logic
        SELECT MAX(created_at) INTO last_notification_time
        FROM notifications
        WHERE user_id = p_agent_user_id
        AND category = notif_category
        AND title = title_text
        AND created_at > (NOW() - INTERVAL '60 minutes');

        -- If a recent notification exists, check if enough time has passed
        IF last_notification_time IS NOT NULL THEN
            -- Calculate minutes since last notification
            minutes_since_last_notification := EXTRACT(EPOCH FROM (NOW() - last_notification_time)) / 60;
            
            -- Different cooldown periods for different notification types
            IF p_notification_type = 'available_now' THEN
                -- Available now: Only send once per break window
                IF minutes_since_last_notification < 60 THEN
                    RETURN; -- Too soon, don't send
                END IF;
            ELSIF p_notification_type = 'ending_soon' THEN
                -- Ending soon: Only send once per 15-minute window
                IF minutes_since_last_notification < 15 THEN
                    RETURN; -- Too soon, don't send
                END IF;
            ELSIF p_notification_type = 'missed_break' THEN
                -- Missed break: Only send once per 30-minute reminder cycle
                IF minutes_since_last_notification < 30 THEN
                    RETURN; -- Too soon, don't send
                END IF;
            END IF;
        END IF;
    END IF;

    -- Insert the notification (database will use default UTC timestamp)
    INSERT INTO notifications (user_id, category, type, title, message, payload)
    VALUES (p_agent_user_id, notif_category, notif_type, title_text, message_text, payload_data);
END;
$function$;

-- Add comment for documentation
COMMENT ON FUNCTION public.create_break_reminder_notification(integer, text, break_type_enum) IS 'Fixed: Prevents duplicate available_soon notifications by checking if one was already sent today for the same break type';
