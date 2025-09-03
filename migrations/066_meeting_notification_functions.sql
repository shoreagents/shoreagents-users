-- Meeting notification functions
-- This migration adds functions to handle meeting notifications

-- Function to send meeting reminder notification (15 minutes before)
CREATE OR REPLACE FUNCTION send_meeting_reminder_notification()
RETURNS INTEGER AS $$
DECLARE
    notifications_sent INTEGER := 0;
    meeting_record RECORD;
BEGIN
    -- Find meetings that are scheduled to start in 15 minutes
    -- and haven't had a reminder notification sent yet
    FOR meeting_record IN
        SELECT m.id, m.agent_user_id, m.title, m.start_time, u.email
        FROM meetings m
        JOIN users u ON u.id = m.agent_user_id
        WHERE m.status = 'scheduled'
        AND m.start_time BETWEEN NOW() + INTERVAL '14 minutes' AND NOW() + INTERVAL '16 minutes'
        AND NOT EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.user_id = m.agent_user_id 
            AND n.category = 'meeting'
            AND n.payload->>'meeting_id' = m.id::text
            AND n.payload->>'notification_type' = 'reminder'
        )
    LOOP
        
        -- Insert notification
        INSERT INTO notifications (
            user_id,
            category,
            type,
            title,
            message,
            payload,
            is_read,
            created_at
        ) VALUES (
            meeting_record.agent_user_id,
            'meeting',
            'info',
            'Meeting Starting Soon',
            'Your meeting "' || meeting_record.title || '" is starting in 15 minutes at ' || 
            TO_CHAR(meeting_record.start_time, 'HH12:MI AM'),
            json_build_object(
                'meeting_id', meeting_record.id,
                'meeting_title', meeting_record.title,
                'start_time', meeting_record.start_time,
                'notification_type', 'reminder',
                'action_url', '/status/meetings'
            ),
            false,
            NOW()
        );
        
        notifications_sent := notifications_sent + 1;
        
        -- Send PostgreSQL notification for real-time updates
        PERFORM pg_notify('notification_created', json_build_object(
            'user_id', meeting_record.agent_user_id,
            'category', 'meeting',
            'type', 'reminder'
        )::text);
        
        RAISE NOTICE 'Sent reminder notification for meeting % to user %', meeting_record.title, meeting_record.email;
    END LOOP;
    
    RETURN notifications_sent;
END;
$$ LANGUAGE plpgsql;

-- Function to send meeting start notification
CREATE OR REPLACE FUNCTION send_meeting_start_notification()
RETURNS INTEGER AS $$
DECLARE
    notifications_sent INTEGER := 0;
    meeting_record RECORD;
BEGIN
    -- Find meetings that just started (within the last 2 minutes)
    -- and haven't had a start notification sent yet
    FOR meeting_record IN
        SELECT m.id, m.agent_user_id, m.title, m.start_time, u.email
        FROM meetings m
        JOIN users u ON u.id = m.agent_user_id
        WHERE m.status = 'in-progress'
        AND m.start_time BETWEEN NOW() - INTERVAL '2 minutes' AND NOW()
        AND NOT EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.user_id = m.agent_user_id 
            AND n.category = 'meeting'
            AND n.payload->>'meeting_id' = m.id::text
            AND n.payload->>'notification_type' = 'start'
        )
    LOOP
        
        -- Insert notification
        INSERT INTO notifications (
            user_id,
            category,
            type,
            title,
            message,
            payload,
            is_read,
            created_at
        ) VALUES (
            meeting_record.agent_user_id,
            'meeting',
            'success',
            'Meeting Started',
            'Your meeting "' || meeting_record.title || '" has started',
            json_build_object(
                'meeting_id', meeting_record.id,
                'meeting_title', meeting_record.title,
                'start_time', meeting_record.start_time,
                'notification_type', 'start',
                'action_url', '/status/meetings'
            ),
            false,
            NOW()
        );
        
        notifications_sent := notifications_sent + 1;
        
        -- Send PostgreSQL notification for real-time updates
        PERFORM pg_notify('notification_created', json_build_object(
            'user_id', meeting_record.agent_user_id,
            'category', 'meeting',
            'type', 'start'
        )::text);
        
        RAISE NOTICE 'Sent start notification for meeting % to user %', meeting_record.title, meeting_record.email;
    END LOOP;
    
    RETURN notifications_sent;
END;
$$ LANGUAGE plpgsql;

-- Function to check and send all meeting notifications
CREATE OR REPLACE FUNCTION check_meeting_notifications()
RETURNS JSON AS $$
DECLARE
    reminders_sent INTEGER;
    starts_sent INTEGER;
    result JSON;
BEGIN
    -- Send reminder notifications (15 minutes before)
    SELECT send_meeting_reminder_notification() INTO reminders_sent;
    
    -- Send start notifications (when meeting starts)
    SELECT send_meeting_start_notification() INTO starts_sent;
    
    -- Return summary
    result := json_build_object(
        'reminders_sent', reminders_sent,
        'starts_sent', starts_sent,
        'total_sent', reminders_sent + starts_sent,
        'timestamp', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add meeting category to notifications table if it doesn't exist
-- (This is handled by the existing constraint, but we'll ensure it's there)
-- The category 'meeting' should already be allowed by the existing CHECK constraint
-- If not, we would need to alter the constraint, but it should already include 'meeting'

-- Create index for better performance on meeting notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_meeting_lookup 
ON notifications (user_id, category, (payload->>'meeting_id'), (payload->>'notification_type'));

-- Create index for meeting start time queries
CREATE INDEX IF NOT EXISTS idx_meetings_notification_queries 
ON meetings (status, start_time) 
WHERE status IN ('scheduled', 'in-progress');
