-- Migration 066: Create meeting scheduler database function
-- This migration creates a function to automatically check and start scheduled meetings

-- Create function to check and start scheduled meetings
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
        AND start_time > NOW() - INTERVAL '1 minute' -- Only start meetings within the last minute to avoid duplicates
    LOOP
        -- Try to start the meeting using the existing start_meeting function
        BEGIN
            -- Call the start_meeting function
            PERFORM start_meeting(meeting_record.id, meeting_record.agent_user_id);
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

-- Create function to check for meeting reminders (1 hour before start)
CREATE OR REPLACE FUNCTION check_meeting_reminders()
RETURNS INTEGER AS $$
DECLARE
    reminders_sent INTEGER := 0;
    meeting_record RECORD;
BEGIN
    -- Find meetings that are scheduled and starting within the next hour
    FOR meeting_record IN
        SELECT id, title, agent_user_id, start_time
        FROM meetings
        WHERE status = 'scheduled'
        AND start_time BETWEEN NOW() + INTERVAL '59 minutes' AND NOW() + INTERVAL '61 minutes'
    LOOP
        -- Create a notification for the meeting reminder
        INSERT INTO notifications (
            user_id,
            title,
            message,
            category,
            type,
            created_at
        ) VALUES (
            meeting_record.agent_user_id,
            'Meeting Reminder',
            'Meeting "' || meeting_record.title || '" starts in 1 hour',
            'meeting',
            'reminder',
            NOW()
        );
        
        reminders_sent := reminders_sent + 1;
        
        -- Log the reminder
        RAISE NOTICE 'Sent reminder for meeting: % (ID: %)', meeting_record.title, meeting_record.id;
    END LOOP;
    
    RETURN reminders_sent;
END;
$$ LANGUAGE plpgsql;

-- Add comments to the functions
COMMENT ON FUNCTION check_and_start_scheduled_meetings() IS 'Automatically starts meetings that are scheduled and due to start now';
COMMENT ON FUNCTION check_meeting_reminders() IS 'Sends reminder notifications for meetings starting within the next hour';
