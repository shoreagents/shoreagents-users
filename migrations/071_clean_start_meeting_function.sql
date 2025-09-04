-- Migration 071: Clean up start_meeting function
-- This migration drops all existing start_meeting functions and creates a clean one

-- Drop all existing start_meeting functions
DROP FUNCTION IF EXISTS start_meeting(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS start_meeting(INTEGER, INTEGER, BOOLEAN);

-- Create a clean start_meeting function with proper parameter handling
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

-- Add comment to the function
COMMENT ON FUNCTION start_meeting(INTEGER, INTEGER, BOOLEAN) IS 'Starts a meeting and sets start_time to actual start time for accurate elapsed time calculation';
