-- Migration 087: Fix event status real-time updates
-- This migration creates a function to send real-time notifications for event status changes
-- and updates the update_all_event_statuses function to use it

-- Create a function to send real-time notifications for event status changes
CREATE OR REPLACE FUNCTION notify_event_status_change(
    event_id INTEGER,
    old_status VARCHAR(20),
    new_status VARCHAR(20)
)
RETURNS VOID AS $$
DECLARE
    event_record RECORD;
    notification_payload JSONB;
    action_url TEXT;
BEGIN
    -- Get event details
    SELECT 
        e.id,
        e.title,
        e.description,
        e.event_date,
        e.start_time,
        e.end_time,
        e.location,
        e.status,
        e.event_type,
        e.created_by,
        u.email as created_by_name
    INTO event_record
    FROM events e
    LEFT JOIN users u ON e.created_by = u.id
    WHERE e.id = event_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Build notification payload
    notification_payload := jsonb_build_object(
        'type', 'event_status_changed',
        'event_id', event_record.id,
        'event_title', event_record.title,
        'event_date', event_record.event_date,
        'start_time', event_record.start_time,
        'end_time', event_record.end_time,
        'location', event_record.location,
        'status', event_record.status,
        'event_type', COALESCE(event_record.event_type, 'event'),
        'old_status', old_status,
        'new_status', new_status,
        'created_by', event_record.created_by,
        'created_by_name', event_record.created_by_name,
        'notification_type', 'event_status_changed'
    );
    
    -- Send real-time notification
    PERFORM pg_notify('event_changes', notification_payload::text);
    
    -- Also send to event_attendance_changes channel for broader coverage
    PERFORM pg_notify('event_attendance_changes', notification_payload::text);
END;
$$ LANGUAGE plpgsql;

-- Update the function to trigger notifications for status changes
CREATE OR REPLACE FUNCTION update_all_event_statuses()
RETURNS TABLE (
    updated_count INTEGER,
    details TEXT
) AS $$
DECLARE
    upcoming_to_today_count INTEGER := 0;
    today_to_ended_count INTEGER := 0;
    past_to_ended_count INTEGER := 0;
    total_updated INTEGER := 0;
    event_record RECORD;
BEGIN
    -- Update events to 'today' if event_date is today (regardless of start_time)
    FOR event_record IN
        SELECT id, title, event_type, start_time, end_time, location, created_by, status
        FROM events 
        WHERE event_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
        AND status = 'upcoming'
    LOOP
        -- Update the event status
        UPDATE events 
        SET status = 'today', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
        WHERE id = event_record.id;
        
        -- Send real-time notification
        PERFORM notify_event_status_change(event_record.id, event_record.status, 'today');
        
        upcoming_to_today_count := upcoming_to_today_count + 1;
    END LOOP;
    
    -- Update events to 'ended' if event_date is in the past
    FOR event_record IN
        SELECT id, title, event_type, start_time, end_time, location, created_by, status
        FROM events 
        WHERE event_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
        AND status IN ('upcoming', 'today')
    LOOP
        -- Update the event status
        UPDATE events 
        SET status = 'ended', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
        WHERE id = event_record.id;
        
        -- Send real-time notification
        PERFORM notify_event_status_change(event_record.id, event_record.status, 'ended');
        
        past_to_ended_count := past_to_ended_count + 1;
    END LOOP;
    
    -- Update events to 'ended' if they are 'today' but have passed their end_time
    FOR event_record IN
        SELECT id, title, event_type, start_time, end_time, location, created_by, status
        FROM events 
        WHERE event_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
        AND status = 'today'
        AND end_time::TIME < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::TIME
    LOOP
        -- Update the event status
        UPDATE events 
        SET status = 'ended', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
        WHERE id = event_record.id;
        
        -- Send real-time notification
        PERFORM notify_event_status_change(event_record.id, event_record.status, 'ended');
        
        today_to_ended_count := today_to_ended_count + 1;
    END LOOP;
    
    total_updated := upcoming_to_today_count + today_to_ended_count + past_to_ended_count;
    
    RETURN QUERY SELECT 
        total_updated,
        format('Updated: %s upcoming→today, %s today→ended (time), %s past→ended', 
               upcoming_to_today_count, today_to_ended_count, past_to_ended_count);
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION notify_event_status_change(INTEGER, VARCHAR(20), VARCHAR(20)) IS 'Sends real-time notifications for event status changes';
COMMENT ON FUNCTION update_all_event_statuses() IS 'Updates event statuses and triggers real-time notifications for status changes';