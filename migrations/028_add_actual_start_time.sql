-- Migration: 028_add_actual_start_time.sql
-- Description: Add actual_start_time column to track when meetings are actually started

-- Add actual_start_time column to meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS actual_start_time timestamptz DEFAULT now() NULL;

-- Update start_meeting function to set actual_start_time when meeting is started
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
    
    -- Update meeting status to in-progress, set is_in_meeting to true, and record actual start time
    UPDATE meetings
    SET status = 'in-progress',
        is_in_meeting = TRUE,
        actual_start_time = NOW(),
        updated_at = now()
    WHERE id = p_meeting_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate get_user_meetings function to include actual_start_time
DROP FUNCTION IF EXISTS get_user_meetings(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_user_meetings(
    p_user_id INTEGER,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    id INTEGER,
    title VARCHAR(255),
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    meeting_type VARCHAR(50),
    status VARCHAR(50),
    is_in_meeting BOOLEAN,
    actual_start_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.title,
        m.description,
        m.start_time,
        m.end_time,
        m.duration_minutes,
        m.meeting_type,
        m.status,
        m.is_in_meeting,
        m.actual_start_time,
        m.created_at
    FROM meetings m
    WHERE m.agent_user_id = p_user_id
    AND m.created_at >= now()::date - INTERVAL '1 day' * p_days
    ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate get_active_meeting function to include actual_start_time
DROP FUNCTION IF EXISTS get_active_meeting(INTEGER);

CREATE OR REPLACE FUNCTION get_active_meeting(p_user_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    title VARCHAR(255),
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    meeting_type VARCHAR(50),
    status VARCHAR(50),
    is_in_meeting BOOLEAN,
    actual_start_time TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.title,
        m.description,
        m.start_time,
        m.end_time,
        m.duration_minutes,
        m.meeting_type,
        m.status,
        m.is_in_meeting,
        m.actual_start_time
    FROM meetings m
    WHERE m.agent_user_id = p_user_id
    AND m.status = 'in-progress'
    ORDER BY m.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql; 