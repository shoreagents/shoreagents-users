-- System Events Tracking Schema
-- Migration: 099_system_events_tracking.sql
-- Description: Creates table to track system suspend/resume and lock/unlock events for productivity monitoring

-- Create system_events table
CREATE TABLE IF NOT EXISTS system_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('suspend', 'resume', 'lock', 'unlock')),
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id VARCHAR(255), -- Optional: to group related events
    metadata JSONB, -- Store additional event data (reason, userAgent, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_system_events_user_id ON system_events(user_id);
CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_timestamp ON system_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_system_events_session_id ON system_events(session_id);
CREATE INDEX IF NOT EXISTS idx_system_events_user_type_timestamp ON system_events(user_id, event_type, event_timestamp);

-- Add comments for documentation
COMMENT ON TABLE system_events IS 'Tracks system suspend/resume and lock/unlock events for productivity monitoring';
COMMENT ON COLUMN system_events.user_id IS 'Reference to the user who triggered the event';
COMMENT ON COLUMN system_events.event_type IS 'Type of system event: suspend, resume, lock, or unlock';
COMMENT ON COLUMN system_events.event_timestamp IS 'When the event occurred (Philippines timezone)';
COMMENT ON COLUMN system_events.session_id IS 'Optional session identifier to group related events';
COMMENT ON COLUMN system_events.metadata IS 'Additional event data stored as JSON (reason, userAgent, etc.)';

-- Function to update the updated_at timestamp (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to send notifications when system events are recorded
CREATE OR REPLACE FUNCTION notify_system_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Send notification for system events
    PERFORM pg_notify(
        'system_events',
        json_build_object(
            'event', 'system_event_recorded',
            'user_id', NEW.user_id,
            'event_type', NEW.event_type,
            'event_timestamp', NEW.event_timestamp,
            'session_id', NEW.session_id,
            'metadata', NEW.metadata
        )::text
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to send notifications when system events are recorded
CREATE TRIGGER notify_system_event_trigger
    AFTER INSERT ON system_events
    FOR EACH ROW
    EXECUTE FUNCTION notify_system_event();

-- Function to get system events for a user within a date range
CREATE OR REPLACE FUNCTION get_user_system_events(
    p_user_id INTEGER,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_event_type VARCHAR(50) DEFAULT NULL,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id INTEGER,
    event_type VARCHAR(50),
    event_timestamp TIMESTAMP WITH TIME ZONE,
    session_id VARCHAR(255),
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        se.id,
        se.event_type,
        se.event_timestamp,
        se.session_id,
        se.metadata
    FROM system_events se
    WHERE se.user_id = p_user_id
        AND (p_start_date IS NULL OR se.event_timestamp >= p_start_date)
        AND (p_end_date IS NULL OR se.event_timestamp <= p_end_date)
        AND (p_event_type IS NULL OR se.event_type = p_event_type)
    ORDER BY se.event_timestamp DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get system suspend/resume statistics for a user
CREATE OR REPLACE FUNCTION get_user_suspend_stats(
    p_user_id INTEGER,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_suspend_events INTEGER,
    total_resume_events INTEGER,
    total_lock_events INTEGER,
    total_unlock_events INTEGER,
    first_suspend_time TIMESTAMP WITH TIME ZONE,
    last_resume_time TIMESTAMP WITH TIME ZONE,
    total_suspend_duration_seconds INTEGER
) AS $$
DECLARE
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Set date range for the specified date
    v_start_date := p_date::TIMESTAMP WITH TIME ZONE;
    v_end_date := (p_date + INTERVAL '1 day')::TIMESTAMP WITH TIME ZONE;
    
    RETURN QUERY
    WITH suspend_resume_pairs AS (
        SELECT 
            se.event_timestamp,
            se.event_type,
            LAG(se.event_timestamp) OVER (ORDER BY se.event_timestamp) as prev_timestamp,
            LAG(se.event_type) OVER (ORDER BY se.event_timestamp) as prev_type
        FROM system_events se
        WHERE se.user_id = p_user_id
            AND se.event_timestamp >= v_start_date
            AND se.event_timestamp < v_end_date
            AND se.event_type IN ('suspend', 'resume', 'lock', 'unlock')
        ORDER BY se.event_timestamp
    ),
    duration_calc AS (
        SELECT 
            SUM(CASE WHEN event_type IN ('suspend', 'lock') THEN 1 ELSE 0 END) as suspend_count,
            SUM(CASE WHEN event_type IN ('resume', 'unlock') THEN 1 ELSE 0 END) as resume_count,
            SUM(CASE WHEN event_type = 'lock' THEN 1 ELSE 0 END) as lock_count,
            SUM(CASE WHEN event_type = 'unlock' THEN 1 ELSE 0 END) as unlock_count,
            MIN(CASE WHEN event_type IN ('suspend', 'lock') THEN event_timestamp END) as first_suspend,
            MAX(CASE WHEN event_type IN ('resume', 'unlock') THEN event_timestamp END) as last_resume,
            SUM(CASE 
                WHEN event_type IN ('resume', 'unlock') AND prev_type IN ('suspend', 'lock') 
                THEN EXTRACT(EPOCH FROM (event_timestamp - prev_timestamp))::INTEGER
                ELSE 0 
            END) as total_duration
        FROM suspend_resume_pairs
    )
    SELECT 
        COALESCE(dc.suspend_count, 0)::INTEGER,
        COALESCE(dc.resume_count, 0)::INTEGER,
        COALESCE(dc.lock_count, 0)::INTEGER,
        COALESCE(dc.unlock_count, 0)::INTEGER,
        dc.first_suspend,
        dc.last_resume,
        COALESCE(dc.total_duration, 0)::INTEGER
    FROM duration_calc dc;
END;
$$ LANGUAGE plpgsql;

-- Add sample data for testing (optional - remove in production)
-- INSERT INTO system_events (user_id, event_type, session_id, metadata) VALUES
-- (1, 'lock', 'session_001', '{"reason": "manual_lock", "userAgent": "test"}'),
-- (1, 'unlock', 'session_001', '{"reason": "manual_unlock", "userAgent": "test"}');
