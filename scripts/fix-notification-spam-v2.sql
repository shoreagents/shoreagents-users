-- Fix notification spam by dropping and recreating the function

DROP FUNCTION IF EXISTS create_break_reminder_notification(INTEGER, TEXT, break_type_enum);
DROP FUNCTION IF EXISTS create_break_reminder_notification(INTEGER, TEXT);

CREATE OR REPLACE FUNCTION create_break_reminder_notification(
    p_user_id INTEGER,
    p_notification_type TEXT,
    p_break_type break_type_enum DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    notification_title TEXT;
    notification_message TEXT;
    recent_notification_count INTEGER;
BEGIN
    -- Check for recent duplicate notifications (within last 10 minutes)
    SELECT COUNT(*) INTO recent_notification_count
    FROM notifications
    WHERE user_id = p_user_id
    AND category = 'break'
    AND type = p_notification_type
    AND (payload->>'break_type' = p_break_type::TEXT OR (payload->>'break_type' IS NULL AND p_break_type IS NULL))
    AND created_at > NOW() - INTERVAL '10 minutes';

    -- If there's already a recent notification of the same type for the same break, skip
    IF recent_notification_count > 0 THEN
        RETURN;
    END IF;

    -- Generate notification content based on type and break
    CASE p_notification_type
        WHEN 'available_soon' THEN
            notification_title := p_break_type || ' Break Available Soon';
            notification_message := p_break_type || ' Break will be available in 15 minutes.';
        WHEN 'available_now' THEN
            notification_title := p_break_type || ' Break Available Now';
            notification_message := p_break_type || ' Break is now available! You can take it now.';
        WHEN 'reminder' THEN
            notification_title := p_break_type || ' Break Reminder';
            notification_message := 'You haven''t taken your ' || p_break_type || ' break yet!';
        WHEN 'ending_soon' THEN
            notification_title := p_break_type || ' Break Ending Soon';
            notification_message := p_break_type || ' Break expires in 15 minutes! Take your break now or you''ll miss it today.';
        ELSE
            notification_title := 'Break Notification';
            notification_message := 'Break notification';
    END CASE;

    -- Insert the notification
    INSERT INTO notifications (
        user_id,
        category,
        type,
        title,
        message,
        payload,
        created_at
    ) VALUES (
        p_user_id,
        'break',
        p_notification_type,
        notification_title,
        notification_message,
        jsonb_build_object(
            'break_type', p_break_type::TEXT,
            'notification_type', p_notification_type
        ),
        NOW()
    );
END;
$$;
