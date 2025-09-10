-- Migration 088: Fix premature event started notifications
-- This migration updates the notify_event_change function to only send
-- "Event Started" notifications when the actual start time has been reached,
-- not just when the status changes to 'today' at midnight.

-- Update the notify_event_change function with proper timing check

CREATE OR REPLACE FUNCTION public.notify_event_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    notification_payload JSONB;
    event_data JSONB;
    created_by_name TEXT;
    action_url TEXT;
    current_time_ph TIME;
    event_start_time TIME;
BEGIN
    -- Get current time in Philippines timezone
    current_time_ph := (NOW() AT TIME ZONE 'Asia/Manila')::TIME;
    
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
            -- Set action URL based on event status
            action_url := '/status/events?tab=upcoming&eventId=' || NEW.id;

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
                    'notification_type', 'event_created',
                    'action_url', action_url
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
            -- Event scheduled for today (status changed to 'today') - Always notify agents
            IF NEW.status = 'today' THEN
                action_url := '/status/events?tab=today&eventId=' || NEW.id;

                -- Send "Today's Event" notification to inform agents about the event
                INSERT INTO notifications (user_id, category, type, title, message, payload)
                SELECT
                    u.id,
                    'event',
                    'info',
                    format('Today''s %s - %s',
                           CASE
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END,
                           NEW.title),
                    format('%s "%s" is scheduled for today at %s (%s)',
                           CASE
                               WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                               ELSE 'Event'
                           END,
                           NEW.title,
                           to_char(NEW.start_time::TIME, 'HH12:MI AM'),
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
                        'notification_type', 'event_scheduled_today',
                        'action_url', action_url
                    )
                FROM users u;

                -- Parse the event start time
                event_start_time := NEW.start_time::TIME;
                
                -- Also send "Event Started" notification if the actual start time has been reached
                IF current_time_ph >= event_start_time THEN
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
                        format('%s "%s" has started at %s (%s)',
                               CASE
                                   WHEN COALESCE(NEW.event_type, 'event') = 'activity' THEN 'Activity'
                                   ELSE 'Event'
                               END,
                               NEW.title,
                               to_char(NEW.start_time::TIME, 'HH12:MI AM'),
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
                            'notification_type', 'event_started',
                            'action_url', action_url
                        )
                    FROM users u;
                END IF;
            END IF;

            -- Event cancelled
            IF NEW.status = 'cancelled' THEN
                action_url := '/status/events?tab=cancelled&eventId=' || NEW.id;

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
                        'notification_type', 'event_cancelled',
                        'action_url', action_url
                    )
                FROM users u;
            END IF;

            -- Event ended
            IF NEW.status = 'ended' THEN
                action_url := '/status/events?tab=ended&eventId=' || NEW.id;

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
                        'notification_type', 'event_ended',
                        'action_url', action_url
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
        action_url := '/status/events?tab=ended&eventId=' || OLD.id;

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
                'notification_type', 'event_deleted',
                'action_url', action_url
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
$function$;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.notify_event_change() IS 'Sends real-time notifications for event changes. Fixed to only send "Event Started" notifications when actual start time is reached, not just when status changes to "today" at midnight.';
