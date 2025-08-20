-- Fix the create_break_reminder_notification function to properly set the type field
-- The function is missing the type field in the INSERT statement

-- Drop the existing function first
DROP FUNCTION IF EXISTS create_break_reminder_notification(INTEGER, TEXT, break_type_enum);

-- Create the fixed function
CREATE FUNCTION create_break_reminder_notification(
    p_user_id INTEGER,
    p_reminder_type TEXT,
    p_break_type break_type_enum DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    notif_category TEXT := 'break';
    notif_type TEXT := 'info';
    title_text TEXT;
    message_text TEXT;
    payload_data JSONB;
    break_name TEXT;
    notification_id INTEGER;
BEGIN
    -- Determine break name for display
    break_name := CASE p_break_type
        WHEN 'Morning' THEN 'Morning Break'
        WHEN 'Lunch' THEN 'Lunch Break'
        WHEN 'Afternoon' THEN 'Afternoon Break'
        WHEN 'NightFirst' THEN 'Night First Break'
        WHEN 'NightMeal' THEN 'Night Meal Break'
        WHEN 'NightSecond' THEN 'Night Second Break'
        ELSE 'Break'
    END;

    -- Set notification type based on reminder type
    notif_type := CASE p_reminder_type
        WHEN 'available_soon' THEN 'info'
        WHEN 'break_available' THEN 'success'
        WHEN 'missed_break' THEN 'warning'
        WHEN 'ending_soon' THEN 'warning'
        WHEN 'break_ending' THEN 'warning'
        ELSE 'info'
    END;

    -- Set title and message based on reminder type
    CASE p_reminder_type
        WHEN 'available_soon' THEN
            title_text := break_name || ' Available Soon';
            message_text := break_name || ' will be available in 15 minutes';
        WHEN 'break_available' THEN
            title_text := break_name || ' Available Now';
            message_text := break_name || ' is now available! You can take it now.';
        WHEN 'missed_break' THEN
            title_text := 'Break Reminder';
            message_text := 'You have not taken your ' || LOWER(break_name) || ' yet!';
        WHEN 'ending_soon' THEN
            title_text := break_name || ' Ending Soon';
            message_text := break_name || ' will be ending soon';
        WHEN 'break_ending' THEN
            title_text := 'Break Ending Soon';
            message_text := 'Your current break will end in 5 minutes';
        ELSE
            title_text := 'Break Reminder';
            message_text := 'Time for your ' || LOWER(break_name);
    END CASE;

    -- Set payload data
    payload_data := jsonb_build_object(
        'reminder_type', p_reminder_type,
        'break_type', p_break_type,
        'break_name', break_name
    );

    -- Insert notification with ALL required fields including type
    INSERT INTO notifications (
        user_id,
        category,
        type,           -- This was missing!
        title,
        message,
        payload,
        created_at
    ) VALUES (
        p_user_id,
        notif_category,
        notif_type,     -- Now properly set
        title_text,
        message_text,
        payload_data,
        NOW()
    ) RETURNING id INTO notification_id;

    RETURN notification_id;
END;
$$;

COMMENT ON FUNCTION create_break_reminder_notification(INTEGER, TEXT, break_type_enum) 
    IS 'Creates break reminder notifications with proper type field setting';
