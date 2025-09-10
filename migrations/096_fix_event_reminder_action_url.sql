-- Migration 096: Fix missing action_url in event reminder notifications
-- This adds the missing action_url to the send_event_reminders function

CREATE OR REPLACE FUNCTION send_event_reminders()
RETURNS INTEGER AS $$
DECLARE
    event_record RECORD;
    reminder_time TIMESTAMP;
    now_time TIMESTAMP;
    notifications_sent INTEGER := 0;
    user_count INTEGER;
BEGIN
    -- Get current time in Asia/Manila timezone
    now_time := NOW() AT TIME ZONE 'Asia/Manila';
    reminder_time := now_time + INTERVAL '15 minutes';
    
    -- Find events that start in approximately 15 minutes and are still upcoming
    FOR event_record IN
        SELECT 
            e.id,
            e.title,
            e.event_date,
            e.start_time,
            e.end_time,
            e.location,
            e.status,
            e.event_type,
            e.created_by,
            u.email as created_by_name
        FROM events e
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.status IN ('upcoming', 'today')
        AND e.event_date = CURRENT_DATE
        AND e.start_time::TIME >= (reminder_time::TIME - INTERVAL '2 minutes')::TIME
        AND e.start_time::TIME <= (reminder_time::TIME + INTERVAL '2 minutes')::TIME
    LOOP
        -- Check if we already sent a reminder for this event today
        IF NOT EXISTS (
            SELECT 1 FROM notifications 
            WHERE payload->>'event_id' = event_record.id::text
            AND payload->>'notification_type' = 'event_reminder'
            AND created_at::date = CURRENT_DATE
        ) THEN
            -- Send reminder notification to all users
            WITH inserted_notifications AS (
                INSERT INTO notifications (user_id, category, type, title, message, payload)
                SELECT 
                    u.id,
                    'event',
                    'info',
                    format('%s Reminder - Starting Soon', 
                           CASE 
                               WHEN COALESCE(event_record.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END),
                format('%s "%s" will start in 15 minutes at %s (%s)', 
                       CASE 
                           WHEN COALESCE(event_record.event_type, 'event') = 'activity' THEN 'Activity'
                           ELSE 'Event'
                       END,
                       event_record.title, 
                       to_char(event_record.start_time::TIME, 'HH12:MI AM'),
                       event_record.location),
                    jsonb_build_object(
                        'event_id', event_record.id,
                        'event_title', event_record.title,
                        'event_date', event_record.event_date,
                        'start_time', event_record.start_time,
                        'end_time', event_record.end_time,
                        'location', event_record.location,
                        'status', event_record.status,
                        'event_type', COALESCE(event_record.event_type, 'event'),
                        'created_by', event_record.created_by,
                        'created_by_name', event_record.created_by_name,
                        'notification_type', 'event_reminder',
                        'action_url', '/status/events?tab=today&eventId=' || event_record.id
                    )
                FROM users u
                RETURNING 1
            )
            SELECT COUNT(*) INTO user_count FROM inserted_notifications;
            notifications_sent := notifications_sent + user_count;
        END IF;
    END LOOP;
    
    RETURN notifications_sent;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION send_event_reminders() IS 'Sends 15-minute reminder notifications for upcoming events with action URLs';
