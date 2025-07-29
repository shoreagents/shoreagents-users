-- Activity Tracker Database Schema
-- This schema stores user activity data including sessions and today's activity

-- Activity Sessions Table
-- Stores individual activity/inactivity sessions
CREATE TABLE activity_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMP NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP,
    session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('active', 'inactive', 'break')),
    duration_ms BIGINT, -- Duration in milliseconds
    end_reason VARCHAR(50) CHECK (end_reason IN ('logout', 'inactivity', 'break', 'natural', 'app-close', 'system-suspend')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Today Activity Data Table
-- Stores today's activity data for each user
CREATE TABLE today_activity_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE, -- YYYY-MM-DD format
    total_active_time_ms BIGINT NOT NULL DEFAULT 0, -- Total active time in milliseconds
    total_inactive_time_ms BIGINT NOT NULL DEFAULT 0, -- Total inactive time in milliseconds
    total_sessions INTEGER NOT NULL DEFAULT 0,
    active_sessions_count INTEGER NOT NULL DEFAULT 0,
    inactive_sessions_count INTEGER NOT NULL DEFAULT 0,
    break_sessions_count INTEGER NOT NULL DEFAULT 0,
    first_activity TIMESTAMP,
    last_activity TIMESTAMP,
    inactivity_alerts_count INTEGER NOT NULL DEFAULT 0,
    is_currently_active BOOLEAN NOT NULL DEFAULT false,
    current_session_start TIMESTAMP,
    last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Weekly Activity Totals Table
-- Stores weekly aggregated activity data
CREATE TABLE weekly_activity_totals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL, -- Start of week (Monday)
    total_active_time_ms BIGINT NOT NULL DEFAULT 0,
    total_inactive_time_ms BIGINT NOT NULL DEFAULT 0,
    total_sessions INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, week_start_date)
);

-- Monthly Activity Totals Table
-- Stores monthly aggregated activity data
CREATE TABLE monthly_activity_totals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_start_date DATE NOT NULL, -- Start of month (YYYY-MM-01)
    total_active_time_ms BIGINT NOT NULL DEFAULT 0,
    total_inactive_time_ms BIGINT NOT NULL DEFAULT 0,
    total_sessions INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, month_start_date)
);

-- Activity Notifications Table
-- Stores activity-related notifications
CREATE TABLE activity_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL, -- 'inactivity_alert', 'session_start', 'session_end', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_activity_sessions_user_id ON activity_sessions(user_id);
CREATE INDEX idx_activity_sessions_start_time ON activity_sessions(start_time);
CREATE INDEX idx_activity_sessions_session_type ON activity_sessions(session_type);
CREATE INDEX idx_activity_sessions_date ON activity_sessions(DATE(start_time));

CREATE INDEX idx_today_activity_user_date ON today_activity_data(user_id, date);
CREATE INDEX idx_today_activity_currently_active ON today_activity_data(is_currently_active);

CREATE INDEX idx_weekly_totals_user_week ON weekly_activity_totals(user_id, week_start_date);

CREATE INDEX idx_monthly_totals_user_month ON monthly_activity_totals(user_id, month_start_date);

CREATE INDEX idx_activity_notifications_user_id ON activity_notifications(user_id);
CREATE INDEX idx_activity_notifications_created_at ON activity_notifications(created_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to tables that have updated_at column
CREATE TRIGGER update_activity_sessions_updated_at 
    BEFORE UPDATE ON activity_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_today_activity_updated_at 
    BEFORE UPDATE ON today_activity_data 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_totals_updated_at 
    BEFORE UPDATE ON weekly_activity_totals 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_totals_updated_at 
    BEFORE UPDATE ON monthly_activity_totals 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get current Philippines time
CREATE OR REPLACE FUNCTION get_philippines_now()
RETURNS TIMESTAMP AS $$
BEGIN
    RETURN NOW() AT TIME ZONE 'Asia/Manila';
END;
$$ LANGUAGE plpgsql;

-- Function to calculate session duration in milliseconds
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
        NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) * 1000;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate session duration
CREATE TRIGGER calculate_session_duration_trigger
    BEFORE INSERT OR UPDATE ON activity_sessions
    FOR EACH ROW EXECUTE FUNCTION calculate_session_duration();

-- Function to initialize today's activity data for a user
CREATE OR REPLACE FUNCTION initialize_today_activity_data(p_user_id INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO today_activity_data (
        user_id,
        date,
        total_active_time_ms,
        total_inactive_time_ms,
        total_sessions,
        active_sessions_count,
        inactive_sessions_count,
        break_sessions_count,
        first_activity,
        last_activity,
        inactivity_alerts_count,
        is_currently_active,
        current_session_start
    ) VALUES (
        p_user_id,
        CURRENT_DATE,
        0,
        0,
        0,
        0,
        0,
        0,
        NULL,
        NULL,
        0,
        false,
        NULL
    )
    ON CONFLICT (user_id, date) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to start an active session
CREATE OR REPLACE FUNCTION start_active_session(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    session_id INTEGER;
BEGIN
    -- Initialize today's activity data if it doesn't exist
    PERFORM initialize_today_activity_data(p_user_id);
    
    -- Insert new session
    INSERT INTO activity_sessions (
        user_id,
        start_time,
        session_type
    ) VALUES (
        p_user_id,
        get_philippines_now(),
        'active'
    ) RETURNING id INTO session_id;
    
    -- Update today's activity data
    UPDATE today_activity_data 
    SET 
        current_session_start = get_philippines_now(),
        is_currently_active = true,
        last_activity = get_philippines_now(),
        active_sessions_count = active_sessions_count + 1,
        total_sessions = total_sessions + 1,
        first_activity = COALESCE(first_activity, get_philippines_now()),
        last_updated = get_philippines_now()
    WHERE user_id = p_user_id AND date = CURRENT_DATE;
    
    RETURN session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to end current session
CREATE OR REPLACE FUNCTION end_current_session(p_user_id INTEGER, p_end_reason VARCHAR(50))
RETURNS VOID AS $$
DECLARE
    session_duration_ms BIGINT;
    session_type VARCHAR(20);
BEGIN
    -- Get the current session details
    SELECT duration_ms, session_type 
    INTO session_duration_ms, session_type
    FROM activity_sessions 
    WHERE user_id = p_user_id 
    AND end_time IS NULL
    ORDER BY start_time DESC 
    LIMIT 1;
    
    -- End the current session
    UPDATE activity_sessions 
    SET 
        end_time = get_philippines_now(),
        end_reason = p_end_reason
    WHERE user_id = p_user_id 
    AND end_time IS NULL;
    
    -- Update today's activity data
    UPDATE today_activity_data 
    SET 
        current_session_start = NULL,
        is_currently_active = false,
        last_activity = get_philippines_now(),
        last_updated = get_philippines_now()
    WHERE user_id = p_user_id AND date = CURRENT_DATE;
    
    -- Update totals based on session type
    IF session_type = 'active' THEN
        UPDATE today_activity_data 
        SET total_active_time_ms = total_active_time_ms + COALESCE(session_duration_ms, 0)
        WHERE user_id = p_user_id AND date = CURRENT_DATE;
    ELSIF session_type = 'inactive' THEN
        UPDATE today_activity_data 
        SET total_inactive_time_ms = total_inactive_time_ms + COALESCE(session_duration_ms, 0)
        WHERE user_id = p_user_id AND date = CURRENT_DATE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's current activity status
CREATE OR REPLACE FUNCTION get_user_activity_status(p_user_id INTEGER)
RETURNS TABLE(
    is_active BOOLEAN,
    current_session_start TIMESTAMP,
    total_active_time_ms BIGINT,
    total_inactive_time_ms BIGINT,
    total_sessions INTEGER,
    active_sessions_count INTEGER,
    inactive_sessions_count INTEGER,
    break_sessions_count INTEGER,
    inactivity_alerts_count INTEGER,
    last_activity_time TIMESTAMP,
    first_activity_time TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tad.is_currently_active,
        tad.current_session_start,
        tad.total_active_time_ms,
        tad.total_inactive_time_ms,
        tad.total_sessions,
        tad.active_sessions_count,
        tad.inactive_sessions_count,
        tad.break_sessions_count,
        tad.inactivity_alerts_count,
        tad.last_activity,
        tad.first_activity
    FROM today_activity_data tad
    WHERE tad.user_id = p_user_id AND tad.date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to get today's activity summary for a user
CREATE OR REPLACE FUNCTION get_today_activity_summary(p_user_id INTEGER)
RETURNS TABLE(
    total_active_time_ms BIGINT,
    total_inactive_time_ms BIGINT,
    total_sessions INTEGER,
    active_sessions_count INTEGER,
    inactive_sessions_count INTEGER,
    break_sessions_count INTEGER,
    first_activity TIMESTAMP,
    last_activity TIMESTAMP,
    inactivity_alerts_count INTEGER,
    is_currently_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tad.total_active_time_ms,
        tad.total_inactive_time_ms,
        tad.total_sessions,
        tad.active_sessions_count,
        tad.inactive_sessions_count,
        tad.break_sessions_count,
        tad.first_activity,
        tad.last_activity,
        tad.inactivity_alerts_count,
        tad.is_currently_active
    FROM today_activity_data tad
    WHERE tad.user_id = p_user_id AND tad.date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to update today's activity data
CREATE OR REPLACE FUNCTION update_today_activity_data(
    p_user_id INTEGER,
    p_active_time_ms BIGINT DEFAULT 0,
    p_inactive_time_ms BIGINT DEFAULT 0,
    p_inactivity_alerts_count INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    -- Initialize today's activity data if it doesn't exist
    PERFORM initialize_today_activity_data(p_user_id);
    
    -- Update today's activity data
    UPDATE today_activity_data 
    SET 
        total_active_time_ms = total_active_time_ms + p_active_time_ms,
        total_inactive_time_ms = total_inactive_time_ms + p_inactive_time_ms,
        inactivity_alerts_count = inactivity_alerts_count + p_inactivity_alerts_count,
        last_activity = get_philippines_now(),
        last_updated = get_philippines_now()
    WHERE user_id = p_user_id AND date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to add activity notification
CREATE OR REPLACE FUNCTION add_activity_notification(
    p_user_id INTEGER,
    p_notification_type VARCHAR(50),
    p_title VARCHAR(255),
    p_message TEXT
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO activity_notifications (
        user_id,
        notification_type,
        title,
        message
    ) VALUES (
        p_user_id,
        p_notification_type,
        p_title,
        p_message
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get unread notifications for a user
CREATE OR REPLACE FUNCTION get_unread_notifications(p_user_id INTEGER)
RETURNS TABLE(
    id INTEGER,
    notification_type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        an.id,
        an.notification_type,
        an.title,
        an.message,
        an.created_at
    FROM activity_notifications an
    WHERE an.user_id = p_user_id 
    AND an.is_read = false
    ORDER BY an.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE activity_notifications 
    SET is_read = true
    WHERE id = p_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get productivity score (active time percentage)
CREATE OR REPLACE FUNCTION get_productivity_score(p_user_id INTEGER)
RETURNS DECIMAL AS $$
DECLARE
    total_active_ms BIGINT;
    total_inactive_ms BIGINT;
    productivity_score DECIMAL;
BEGIN
    SELECT 
        COALESCE(total_active_time_ms, 0),
        COALESCE(total_inactive_time_ms, 0)
    INTO total_active_ms, total_inactive_ms
    FROM today_activity_data
    WHERE user_id = p_user_id AND date = CURRENT_DATE;
    
    IF total_active_ms + total_inactive_ms = 0 THEN
        RETURN 0;
    END IF;
    
    productivity_score = (total_active_ms::DECIMAL / (total_active_ms + total_inactive_ms)::DECIMAL) * 100;
    RETURN ROUND(productivity_score, 1);
END;
$$ LANGUAGE plpgsql;

-- Function to reset today's activity data (for new day)
CREATE OR REPLACE FUNCTION reset_today_activity_data(p_user_id INTEGER)
RETURNS VOID AS $$
BEGIN
    -- Archive today's data to weekly/monthly totals if needed
    -- Then reset today's data
    UPDATE today_activity_data 
    SET 
        total_active_time_ms = 0,
        total_inactive_time_ms = 0,
        total_sessions = 0,
        active_sessions_count = 0,
        inactive_sessions_count = 0,
        break_sessions_count = 0,
        first_activity = NULL,
        last_activity = NULL,
        inactivity_alerts_count = 0,
        is_currently_active = false,
        current_session_start = NULL,
        last_updated = get_philippines_now()
    WHERE user_id = p_user_id AND date = CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old sessions (older than specified days)
CREATE OR REPLACE FUNCTION cleanup_old_sessions(p_days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM activity_sessions 
    WHERE start_time < NOW() - INTERVAL '1 day' * p_days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE activity_sessions IS 'Stores individual activity/inactivity sessions for users';
COMMENT ON TABLE today_activity_data IS 'Stores today''s activity data for each user';
COMMENT ON TABLE weekly_activity_totals IS 'Stores weekly aggregated activity totals';
COMMENT ON TABLE monthly_activity_totals IS 'Stores monthly aggregated activity totals';
COMMENT ON TABLE activity_notifications IS 'Stores activity-related notifications for users'; 