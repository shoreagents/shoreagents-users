-- Migration 079: Fix meeting and activity conflict
-- This migration updates the start_meeting function to prevent starting meetings when user is in an activity/event

-- Update the start_meeting function to check for active activities/events
CREATE OR REPLACE FUNCTION start_meeting(meeting_id_param INTEGER, agent_user_id_param INTEGER, is_automatic BOOLEAN DEFAULT FALSE)
RETURNS JSON AS $$
DECLARE
    meeting_record RECORD;
    activity_check RECORD;
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
    
    -- Check if user is currently in an activity/event
    SELECT ea.is_going, e.title as event_title, e.event_type
    INTO activity_check
    FROM event_attendance ea
    JOIN events e ON ea.event_id = e.id
    WHERE ea.user_id = agent_user_id_param 
    AND ea.is_going = true 
    AND ea.is_back = false
    AND e.status NOT IN ('cancelled', 'ended');
    
    IF FOUND THEN
        -- User is currently in an activity/event, prevent meeting start
        RETURN json_build_object(
            'success', false, 
            'message', 'Cannot start meeting while in ' || LOWER(activity_check.event_type) || ': ' || activity_check.event_title || '. Please leave the ' || LOWER(activity_check.event_type) || ' first.'
        );
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
    
    -- Start the meeting and update start_time to actual start time for accurate duration calculation
    UPDATE meetings
    SET 
        status = 'in-progress',
        is_in_meeting = true,
        started_automatically = is_automatic,
        start_time = NOW()  -- Always use actual start time for accurate elapsed time calculation
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

-- Add comment for documentation
COMMENT ON FUNCTION start_meeting(INTEGER, INTEGER, BOOLEAN) IS 'Updated: Prevents starting meetings when user is in an activity/event to avoid conflicts';
