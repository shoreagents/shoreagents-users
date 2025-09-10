-- Migration 076: Add real-time notifications for events
-- This migration creates PostgreSQL functions and triggers for real-time event notifications

-- Create a function to send notifications when events are created or updated
CREATE OR REPLACE FUNCTION notify_event_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_payload JSONB;
    event_data JSONB;
    created_by_name TEXT;
BEGIN
    -- Get the name of the user who created the event
    SELECT email INTO created_by_name
    FROM users 
    WHERE id = COALESCE(NEW.created_by, OLD.created_by);
    
    -- Determine the operation type
    IF TG_OP = 'INSERT' THEN
        event_data := to_jsonb(NEW);
        notification_payload := jsonb_build_object(
            'type', 'event_created',
            'event_id', NEW.id,
            'event_title', NEW.title,
            'event_date', NEW.event_date,
            'start_time', NEW.start_time,
            'end_time', NEW.end_time,
            'location', NEW.location,
            'status', NEW.status,
            'created_by', NEW.created_by,
            'created_at', NEW.created_at,
            'data', event_data
        );
        
        -- Create notifications for all users about the new event (only if status is upcoming)
        IF NEW.status = 'upcoming' THEN
            INSERT INTO notifications (user_id, category, type, title, message, payload)
            SELECT 
                u.id,
                'event',
                'info',
                format('New %s Scheduled', 
                       CASE 
                           WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                           ELSE 'Event'
                       END),
                format('A new %s "%s" has been scheduled for %s at %s', 
                       CASE 
                           WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'activity'
                           ELSE 'event'
                       END,
                       NEW.title, 
                       to_char(NEW.event_date AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD'),
                       NEW.start_time),
                jsonb_build_object(
                    'event_id', NEW.id,
                    'event_title', NEW.title,
                    'event_date', NEW.event_date,
                    'start_time', NEW.start_time,
                    'end_time', NEW.end_time,
                    'location', NEW.location,
                    'status', NEW.status,
                    'event_type', COALESCE(NEW.event_type, 'event'),
                    'created_by', NEW.created_by,
                    'created_by_name', created_by_name,
                    'notification_type', 'event_created'
                )
            FROM users u
            WHERE u.id != NEW.created_by; -- Don't notify the creator
        END IF;
        
    ELSIF TG_OP = 'UPDATE' THEN
        event_data := to_jsonb(NEW);
        notification_payload := jsonb_build_object(
            'type', 'event_updated',
            'event_id', NEW.id,
            'event_title', NEW.title,
            'event_date', NEW.event_date,
            'start_time', NEW.start_time,
            'end_time', NEW.end_time,
            'location', NEW.location,
            'status', NEW.status,
            'created_by', NEW.created_by,
            'updated_at', NEW.updated_at,
            'old_data', to_jsonb(OLD),
            'new_data', event_data
        );
        
        -- Create notifications for all users about the event update (only for specific status changes)
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            -- Event started (status changed to 'today')
            IF NEW.status = 'today' THEN
                INSERT INTO notifications (user_id, category, type, title, message, payload)
                SELECT 
                    u.id,
                    'event',
                    'info',
                    format('%s Started - Please Join', 
                           CASE 
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END),
                    format('%s "%s" has started! Please join at %s', 
                           CASE 
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END,
                           NEW.title, 
                           NEW.location),
                    jsonb_build_object(
                        'event_id', NEW.id,
                        'event_title', NEW.title,
                        'event_date', NEW.event_date,
                        'start_time', NEW.start_time,
                        'end_time', NEW.end_time,
                        'location', NEW.location,
                        'event_type', COALESCE(NEW.event_type, 'event'),
                        'old_status', OLD.status,
                        'new_status', NEW.status,
                        'created_by', NEW.created_by,
                        'created_by_name', created_by_name,
                        'notification_type', 'event_started'
                    )
                FROM users u;
            END IF;
            
            -- Event cancelled
            IF NEW.status = 'cancelled' THEN
                INSERT INTO notifications (user_id, category, type, title, message, payload)
                SELECT 
                    u.id,
                    'event',
                    'warning',
                    format('%s Cancelled', 
                           CASE 
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END),
                    format('%s "%s" scheduled for %s has been cancelled', 
                           CASE 
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END,
                           NEW.title, 
                           to_char(NEW.event_date AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')),
                    jsonb_build_object(
                        'event_id', NEW.id,
                        'event_title', NEW.title,
                        'event_date', NEW.event_date,
                        'start_time', NEW.start_time,
                        'end_time', NEW.end_time,
                        'location', NEW.location,
                        'event_type', COALESCE(NEW.event_type, 'event'),
                        'old_status', OLD.status,
                        'new_status', NEW.status,
                        'created_by', NEW.created_by,
                        'created_by_name', created_by_name,
                        'notification_type', 'event_cancelled'
                    )
                FROM users u;
            END IF;
            
            -- No notification for 'ended' status
        END IF;
        
    ELSIF TG_OP = 'DELETE' THEN
        event_data := to_jsonb(OLD);
        notification_payload := jsonb_build_object(
            'type', 'event_deleted',
            'event_id', OLD.id,
            'event_title', OLD.title,
            'event_date', OLD.event_date,
            'data', event_data
        );
        
        -- Create notifications for all users about the event deletion
        INSERT INTO notifications (user_id, category, type, title, message, payload)
        SELECT 
            u.id,
            'event',
            'warning',
            'Event Deleted',
            format('Event "%s" scheduled for %s has been deleted', 
                   OLD.title, 
                   to_char(OLD.event_date AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')),
            jsonb_build_object(
                'event_id', OLD.id,
                'event_title', OLD.title,
                'event_date', OLD.event_date,
                'start_time', OLD.start_time,
                'end_time', OLD.end_time,
                'location', OLD.location,
                'notification_type', 'event_deleted'
            )
        FROM users u;
    END IF;

    -- Send the notification for real-time updates
    PERFORM pg_notify('event_changes', notification_payload::text);
    
    -- Return the appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a function to send notifications when event attendance changes
CREATE OR REPLACE FUNCTION notify_event_attendance_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_payload JSONB;
    event_data JSONB;
    user_data JSONB;
BEGIN
    -- Get event details
    SELECT to_jsonb(e) INTO event_data
    FROM events e
    WHERE e.id = COALESCE(NEW.event_id, OLD.event_id);
    
    -- Get user details
    SELECT to_jsonb(u) INTO user_data
    FROM users u
    WHERE u.id = COALESCE(NEW.user_id, OLD.user_id);
    
    -- Determine the operation type
    IF TG_OP = 'INSERT' THEN
        notification_payload := jsonb_build_object(
            'type', 'event_attendance_created',
            'event_id', NEW.event_id,
            'user_id', NEW.user_id,
            'is_going', NEW.is_going,
            'is_back', NEW.is_back,
            'going_at', NEW.going_at,
            'back_at', NEW.back_at,
            'event_data', event_data,
            'user_data', user_data
        );
    ELSIF TG_OP = 'UPDATE' THEN
        notification_payload := jsonb_build_object(
            'type', 'event_attendance_updated',
            'event_id', NEW.event_id,
            'user_id', NEW.user_id,
            'is_going', NEW.is_going,
            'is_back', NEW.is_back,
            'going_at', NEW.going_at,
            'back_at', NEW.back_at,
            'old_data', to_jsonb(OLD),
            'new_data', to_jsonb(NEW),
            'event_data', event_data,
            'user_data', user_data
        );
    ELSIF TG_OP = 'DELETE' THEN
        notification_payload := jsonb_build_object(
            'type', 'event_attendance_deleted',
            'event_id', OLD.event_id,
            'user_id', OLD.user_id,
            'event_data', event_data,
            'user_data', user_data
        );
    END IF;

    -- Send the notification
    PERFORM pg_notify('event_attendance_changes', notification_payload::text);
    
    -- Return the appropriate record
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for events table
DROP TRIGGER IF EXISTS events_notify_trigger ON events;
CREATE TRIGGER events_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON events
    FOR EACH ROW
    EXECUTE FUNCTION notify_event_change();

-- Create triggers for event_attendance table
DROP TRIGGER IF EXISTS event_attendance_notify_trigger ON event_attendance;
CREATE TRIGGER event_attendance_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON event_attendance
    FOR EACH ROW
    EXECUTE FUNCTION notify_event_attendance_change();

-- Create indexes for better performance on notification queries
CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, event_date);
CREATE INDEX IF NOT EXISTS idx_event_attendance_user_event ON event_attendance(user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendance_going ON event_attendance(is_going, is_back) WHERE is_going = true;

-- Create a function to send 15-minute reminder notifications for upcoming events
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

-- Add comments for documentation
COMMENT ON FUNCTION notify_event_change() IS 'Sends real-time notifications when events are created, updated, or deleted';
COMMENT ON FUNCTION notify_event_attendance_change() IS 'Sends real-time notifications when event attendance changes';
COMMENT ON FUNCTION send_event_reminders() IS 'Sends 15-minute reminder notifications for upcoming events';
COMMENT ON TRIGGER events_notify_trigger ON events IS 'Triggers notifications for event changes';
COMMENT ON TRIGGER event_attendance_notify_trigger ON event_attendance IS 'Triggers notifications for event attendance changes';
