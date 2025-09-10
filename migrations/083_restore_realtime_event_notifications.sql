-- Migration 083: Restore real-time event notifications
-- This migration restores the real-time notification functionality that was removed in migration 081
-- It adds back the pg_notify calls for socket server real-time updates while keeping the simplified notification logic

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
            
            -- Event ended
            IF NEW.status = 'ended' THEN
                INSERT INTO notifications (user_id, category, type, title, message, payload)
                SELECT 
                    u.id,
                    'event',
                    'info',
                    format('%s Ended', 
                           CASE 
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END),
                    format('%s "%s" has ended', 
                           CASE 
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END,
                           NEW.title),
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
                        'notification_type', 'event_ended'
                    )
                FROM users u;
            END IF;
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

-- Add comments for documentation
COMMENT ON FUNCTION notify_event_change() IS 'Sends real-time notifications when events are created, updated, or deleted with pg_notify for socket server updates';
