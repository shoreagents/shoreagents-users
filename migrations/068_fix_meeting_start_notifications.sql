-- Migration 068: Fix meeting start notifications to only send for automatically started meetings
-- This migration modifies the notification system to only send notifications for scheduled meetings that start automatically

-- Add a column to track if a meeting was started automatically
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS started_automatically BOOLEAN DEFAULT FALSE;

-- Create an index for the new column
CREATE INDEX IF NOT EXISTS idx_meetings_started_automatically ON meetings (started_automatically);

-- Update the start_meeting function to accept an optional parameter for automatic starts
CREATE OR REPLACE FUNCTION start_meeting(meeting_id_param INTEGER, agent_user_id_param INTEGER, is_automatic BOOLEAN DEFAULT FALSE)
RETURNS JSON AS $$
DECLARE
    meeting_record RECORD;
    result JSON;
BEGIN
    -- Check if meeting exists and belongs to the agent
    SELECT * INTO meeting_record
    FROM meetings
    WHERE id = meeting_id_param AND agent_user_id = agent_user_id_param;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Meeting not found');
    END IF;
    
    -- Check if meeting is already in progress
    IF meeting_record.is_in_meeting THEN
        RETURN json_build_object('success', false, 'message', 'Meeting is already in progress');
    END IF;
    
    -- Check if meeting is scheduled and it's time to start
    IF meeting_record.status = 'scheduled' THEN
        -- For automatic starts, allow starting if current time is at or after scheduled start time
        -- For manual starts, allow starting if current time is at or after scheduled start time (with grace period)
        IF is_automatic THEN
            -- Automatic starts: must be at or after scheduled time
            IF NOW() < meeting_record.start_time THEN
                RETURN json_build_object('success', false, 'message', 'Meeting is scheduled for a future time');
            END IF;
        ELSE
            -- Manual starts: allow starting up to 10 minutes before scheduled time
            IF NOW() < (meeting_record.start_time - INTERVAL '10 minutes') THEN
                RETURN json_build_object('success', false, 'message', 'Meeting is scheduled for a future time');
            END IF;
        END IF;
    END IF;
    
    -- Start the meeting
    UPDATE meetings
    SET 
        status = 'in-progress',
        is_in_meeting = true,
        started_automatically = is_automatic,
        start_time = CASE 
            WHEN status = 'scheduled' THEN start_time  -- Keep original scheduled time
            ELSE NOW()  -- Use current time for immediate meetings
        END
    WHERE id = meeting_id_param;
    
    -- Get updated meeting record
    SELECT * INTO meeting_record
    FROM meetings
    WHERE id = meeting_id_param;
    
    -- Build result
    result := json_build_object(
        'success', true,
        'message', 'Meeting started successfully',
        'meeting', row_to_json(meeting_record)
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update the check_and_start_scheduled_meetings function to mark meetings as automatically started
CREATE OR REPLACE FUNCTION check_and_start_scheduled_meetings()
RETURNS INTEGER AS $$
DECLARE
    meetings_started INTEGER := 0;
    meeting_record RECORD;
BEGIN
    -- Find meetings that are scheduled and should start now
    FOR meeting_record IN
        SELECT id, title, agent_user_id, start_time
        FROM meetings
        WHERE status = 'scheduled'
        AND start_time <= NOW()
        AND start_time > NOW() - INTERVAL '24 hours' -- Only start meetings within the last 24 hours to avoid starting very old meetings
    LOOP
        -- Try to start the meeting using the existing start_meeting function with automatic flag
        BEGIN
            -- Call the start_meeting function with is_automatic = true
            PERFORM start_meeting(meeting_record.id, meeting_record.agent_user_id, true);
            meetings_started := meetings_started + 1;
            
            -- Log the meeting start
            RAISE NOTICE 'Automatically started meeting: % (ID: %)', meeting_record.title, meeting_record.id;
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Log any errors but continue processing other meetings
                RAISE NOTICE 'Failed to start meeting % (ID: %): %', meeting_record.title, meeting_record.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN meetings_started;
END;
$$ LANGUAGE plpgsql;

-- Update the send_meeting_start_notification function to only send notifications for automatically started meetings
CREATE OR REPLACE FUNCTION send_meeting_start_notification()
RETURNS INTEGER AS $$
DECLARE
    notifications_sent INTEGER := 0;
    meeting_record RECORD;
BEGIN
    -- Find meetings that just started automatically (within the last 2 minutes)
    -- and haven't had a start notification sent yet
    FOR meeting_record IN
        SELECT m.id, m.agent_user_id, m.title, m.start_time, u.email
        FROM meetings m
        JOIN users u ON u.id = m.agent_user_id
        WHERE m.status = 'in-progress'
        AND m.started_automatically = true  -- Only send notifications for automatically started meetings
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
            'Meeting Started Automatically',
            'Your scheduled meeting "' || meeting_record.title || '" has started automatically',
            json_build_object(
                'meeting_id', meeting_record.id,
                'meeting_title', meeting_record.title,
                'start_time', meeting_record.start_time,
                'notification_type', 'start',
                'started_automatically', true,
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
        
        RAISE NOTICE 'Sent start notification for automatically started meeting % to user %', meeting_record.title, meeting_record.email;
    END LOOP;
    
    RETURN notifications_sent;
END;
$$ LANGUAGE plpgsql;

-- Update the index for meeting notification queries to include the new column
DROP INDEX IF EXISTS idx_meetings_notification_queries;
CREATE INDEX idx_meetings_notification_queries 
ON meetings (status, start_time, started_automatically) 
WHERE status IN ('scheduled', 'in-progress');

-- Add comments to the updated functions
COMMENT ON FUNCTION start_meeting(INTEGER, INTEGER, BOOLEAN) IS 'Start a meeting with optional automatic flag to control notifications';
COMMENT ON FUNCTION check_and_start_scheduled_meetings() IS 'Automatically starts meetings that are scheduled and due to start now, marking them as automatically started';
COMMENT ON FUNCTION send_meeting_start_notification() IS 'Sends start notifications only for meetings that were started automatically by the scheduler';
