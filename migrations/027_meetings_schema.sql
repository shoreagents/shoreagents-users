-- Migration: 027_meetings_schema.sql
-- Description: Create meetings schema for meeting management functionality

-- Create meetings table
CREATE TABLE IF NOT EXISTS meetings (
    id SERIAL PRIMARY KEY,
    agent_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time timestamptz DEFAULT now() NULL,
    end_time timestamptz DEFAULT now() NULL,
    duration_minutes INTEGER NOT NULL,
    meeting_type VARCHAR(50) NOT NULL CHECK (meeting_type IN ('video', 'audio', 'in-person')),
    status VARCHAR(50) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in-progress', 'completed', 'cancelled')),
    is_in_meeting BOOLEAN NOT NULL DEFAULT FALSE,
    created_at timestamptz DEFAULT now() NULL,
    updated_at timestamptz DEFAULT now() NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_meetings_agent_user_id ON meetings(agent_user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_meetings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_meetings_updated_at();

-- Create function to get meetings for a user
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
        m.created_at
    FROM meetings m
    WHERE m.agent_user_id = p_user_id
    AND m.created_at >= now()::date - INTERVAL '1 day' * p_days
    ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get meeting statistics
CREATE OR REPLACE FUNCTION get_meeting_statistics(
    p_user_id INTEGER,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    total_meetings INTEGER,
    completed_meetings INTEGER,
    cancelled_meetings INTEGER,
    total_duration_minutes INTEGER,
    avg_duration_minutes NUMERIC,
    today_meetings INTEGER,
    today_duration_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(*) as total_count,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
            SUM(duration_minutes) as total_duration,
            AVG(duration_minutes) as avg_duration,
            COUNT(*) FILTER (WHERE DATE(created_at) = now()::date) as today_count,
            SUM(duration_minutes) FILTER (WHERE DATE(created_at) = now()::date) as today_duration
        FROM meetings
        WHERE agent_user_id = p_user_id
        AND created_at >= now()::date - INTERVAL '1 day' * p_days
    )
    SELECT 
        COALESCE(total_count, 0),
        COALESCE(completed_count, 0),
        COALESCE(cancelled_count, 0),
        COALESCE(total_duration, 0),
        COALESCE(avg_duration, 0),
        COALESCE(today_count, 0),
        COALESCE(today_duration, 0)
    FROM stats;
END;
$$ LANGUAGE plpgsql;

-- Create function to start a meeting
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
    
    -- Update meeting status to in-progress and set is_in_meeting to true
    UPDATE meetings
    SET status = 'in-progress',
        is_in_meeting = TRUE,
        updated_at = now()
    WHERE id = p_meeting_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to end a meeting
CREATE OR REPLACE FUNCTION end_meeting(p_meeting_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    meeting_record meetings%ROWTYPE;
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
    
    -- Update meeting status to completed and set is_in_meeting to false
    UPDATE meetings
    SET status = 'completed',
        is_in_meeting = FALSE,
        updated_at = now()
    WHERE id = p_meeting_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to cancel a meeting
CREATE OR REPLACE FUNCTION cancel_meeting(p_meeting_id INTEGER)
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
    
    -- Update meeting status to cancelled and set is_in_meeting to false
    UPDATE meetings
    SET status = 'cancelled',
        is_in_meeting = FALSE,
        updated_at = now()
    WHERE id = p_meeting_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to get active meeting for a user
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
    is_in_meeting BOOLEAN
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
        m.is_in_meeting
    FROM meetings m
    WHERE m.agent_user_id = p_user_id
    AND m.status = 'in-progress'
    ORDER BY m.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if user is in a meeting
CREATE OR REPLACE FUNCTION is_user_in_meeting(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    meeting_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO meeting_count
    FROM meetings
    WHERE agent_user_id = p_user_id
    AND is_in_meeting = TRUE
    AND status = 'in-progress';
    
    RETURN meeting_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's current meeting status
CREATE OR REPLACE FUNCTION get_user_meeting_status(p_user_id INTEGER)
RETURNS TABLE (
    is_in_meeting BOOLEAN,
    meeting_id INTEGER,
    meeting_title VARCHAR(255),
    meeting_type VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.is_in_meeting,
        m.id,
        m.title,
        m.meeting_type
    FROM meetings m
    WHERE m.agent_user_id = p_user_id
    AND m.is_in_meeting = TRUE
    AND m.status = 'in-progress'
    ORDER BY m.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Add comment to the migration
COMMENT ON TABLE meetings IS 'Stores meeting information for users';
COMMENT ON COLUMN meetings.agent_user_id IS 'Reference to the user who created the meeting';
COMMENT ON COLUMN meetings.meeting_type IS 'Type of meeting: video, audio, or in-person';
COMMENT ON COLUMN meetings.status IS 'Current status of the meeting: scheduled, in-progress, completed, or cancelled';
COMMENT ON COLUMN meetings.is_in_meeting IS 'Indicates if the user is currently in this meeting'; 