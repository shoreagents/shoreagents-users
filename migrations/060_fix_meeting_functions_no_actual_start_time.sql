-- Fix meeting functions to work without actual_start_time column
-- This migration updates the functions to use start_time instead of actual_start_time

-- Update the end_meeting function to calculate duration based on start_time only
CREATE OR REPLACE FUNCTION end_meeting(p_meeting_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    meeting_record meetings%ROWTYPE;
    actual_duration_minutes INTEGER;
BEGIN
    -- Get the meeting
    SELECT * INTO meeting_record
    FROM meetings
    WHERE id = p_meeting_id;
    
    -- Check if meeting exists and is in-progress
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    IF meeting_record.status != 'in-progress' THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate actual duration in minutes based on start_time
    actual_duration_minutes := EXTRACT(EPOCH FROM (NOW() - meeting_record.start_time)) / 60;
    
    -- Update meeting status to completed, set is_in_meeting to false, 
    -- set end_time to current time, and update duration_minutes
    UPDATE meetings
    SET status = 'completed',
        is_in_meeting = FALSE,
        end_time = NOW(),
        duration_minutes = actual_duration_minutes,
        updated_at = now()
    WHERE id = p_meeting_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Update the start_meeting function to work without actual_start_time
CREATE OR REPLACE FUNCTION start_meeting(p_meeting_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    meeting_record meetings%ROWTYPE;
BEGIN
    -- Get the meeting
    SELECT * INTO meeting_record
    FROM meetings
    WHERE id = p_meeting_id;
    
    -- Check if meeting exists and is scheduled
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    IF meeting_record.status != 'scheduled' THEN
        RETURN FALSE;
    END IF;
    
    -- Update meeting status to in-progress, set is_in_meeting to true
    -- Keep the original start_time (scheduled time)
    UPDATE meetings
    SET status = 'in-progress',
        is_in_meeting = TRUE,
        updated_at = now()
    WHERE id = p_meeting_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add comments to the functions
COMMENT ON FUNCTION end_meeting(INTEGER) IS 'Ends a meeting and calculates actual duration based on start_time';
COMMENT ON FUNCTION start_meeting(INTEGER) IS 'Starts a scheduled meeting and changes status to in-progress';
