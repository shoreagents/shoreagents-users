-- Drop actual_start_time column from meetings table
-- This column is no longer needed with the new open-ended meeting system

-- First, update the start_meeting function to remove references to actual_start_time
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

-- Update the end_meeting function to remove references to actual_start_time
CREATE OR REPLACE FUNCTION end_meeting(meeting_id_param INTEGER, agent_user_id_param INTEGER)
RETURNS JSON AS $$
DECLARE
    meeting_record RECORD;
    duration_minutes INTEGER;
    result JSON;
BEGIN
    -- Check if meeting exists and belongs to the agent
    SELECT * INTO meeting_record
    FROM meetings
    WHERE id = meeting_id_param AND agent_user_id = agent_user_id_param;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Meeting not found');
    END IF;
    
    -- Check if meeting is in progress
    IF NOT meeting_record.is_in_meeting THEN
        RETURN json_build_object('success', false, 'message', 'Meeting is not in progress');
    END IF;
    
    -- Calculate duration based on start_time (since actual_start_time is being removed)
    duration_minutes := EXTRACT(EPOCH FROM (NOW() - meeting_record.start_time)) / 60;
    
    -- End the meeting
    UPDATE meetings
    SET 
        status = 'completed',
        is_in_meeting = false,
        end_time = NOW(),
        duration_minutes = duration_minutes
    WHERE id = meeting_id_param;
    
    -- Get updated meeting record
    SELECT * INTO meeting_record
    FROM meetings
    WHERE id = meeting_id_param;
    
    -- Build result
    result := json_build_object(
        'success', true,
        'message', 'Meeting ended successfully',
        'meeting', row_to_json(meeting_record)
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Now drop the actual_start_time column
ALTER TABLE meetings DROP COLUMN IF EXISTS actual_start_time;
