-- Fix activity started notification to only trigger when activity actually starts
-- This migration removes the premature "Activity Started" notification from the database trigger
-- and ensures notifications are only sent when the start time has actually passed

-- Update the event status trigger to remove premature "started" notifications
CREATE OR REPLACE FUNCTION update_event_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update events to 'today' if event_date is today (Philippines time) - regardless of start_time
    UPDATE events 
    SET status = 'today', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE event_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
    AND status = 'upcoming';
    
    -- Update events to 'ended' if event_date is in the past and status is not 'cancelled' (Philippines time)
    UPDATE events 
    SET status = 'ended', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE event_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
    AND status IN ('upcoming', 'today');
    
    -- Update events to 'ended' if they are 'today' but have passed their end_time (Philippines time)
    UPDATE events 
    SET status = 'ended', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE event_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
    AND status = 'today'
    AND end_time::TIME < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::TIME;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Update the event change trigger to remove premature "started" notifications
-- The "Activity Started" notifications should only come from the event reminder scheduler
-- when the start time has actually passed, not when status changes to 'today'
CREATE OR REPLACE FUNCTION notify_event_change()
RETURNS TRIGGER AS $$
DECLARE
    created_by_name TEXT;
BEGIN
    -- Get created by name
    SELECT email INTO created_by_name 
    FROM users 
    WHERE id = NEW.created_by;
    
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
            format('%s "%s" has been cancelled', 
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
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
