-- Migration: 064_fix_meeting_start_time.sql
-- Description: Fix the start_meeting function to use actual start time instead of scheduled time

-- Update the start_meeting function to use actual start time
CREATE OR REPLACE FUNCTION start_meeting(meeting_id_param INTEGER, agent_user_id_param INTEGER)
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
        -- Allow starting if current time is at or after scheduled start time
        IF NOW() < meeting_record.start_time THEN
            RETURN json_build_object('success', false, 'message', 'Meeting is scheduled for a future time');
        END IF;
    END IF;
    
    -- Start the meeting and update start_time to actual start time
    UPDATE meetings
    SET 
        status = 'in-progress',
        is_in_meeting = true,
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
COMMENT ON FUNCTION start_meeting(INTEGER, INTEGER) IS 'Starts a meeting and sets start_time to actual start time for accurate elapsed time calculation';
