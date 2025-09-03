-- Migration: 063_restore_start_meeting_validation.sql
-- Description: Restore the start_meeting function with proper validation to prevent starting meetings with future start times

-- Update the start_meeting function to include proper validation
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
    
    -- Start the meeting
    UPDATE meetings
    SET 
        status = 'in-progress',
        is_in_meeting = true,
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

-- Add comment to the function
COMMENT ON FUNCTION start_meeting(INTEGER, INTEGER) IS 'Starts a meeting with proper validation to prevent starting meetings with future start times';
