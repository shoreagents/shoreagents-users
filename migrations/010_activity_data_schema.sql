-- Activity Data Schema
-- Enhanced with real-time notifications and daily time tracking
-- Fixed timezone handling for Philippines timezone (GMT+8)

-- Activity data table
CREATE TABLE IF NOT EXISTS activity_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_currently_active BOOLEAN DEFAULT false,
    -- Daily time tracking
    today_active_seconds INTEGER DEFAULT 0,
    today_inactive_seconds INTEGER DEFAULT 0,
    last_session_start TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Index for better performance
CREATE INDEX IF NOT EXISTS idx_activity_data_user_id ON activity_data(user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to get current time in Philippines timezone (GMT+8)
CREATE OR REPLACE FUNCTION get_philippines_now()
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    -- Return Philippines time (GMT+8)
    RETURN NOW() AT TIME ZONE 'Asia/Manila';
END;
$$ language 'plpgsql';

-- Function to calculate time difference safely for Philippines timezone
CREATE OR REPLACE FUNCTION calculate_time_diff(
    last_update TIMESTAMP WITH TIME ZONE,
    current_time TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    time_diff INTEGER;
    philippines_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Use provided time or get current Philippines time
    IF current_time IS NULL THEN
        philippines_time := NOW() AT TIME ZONE 'Asia/Manila';
    ELSE
        philippines_time := current_time AT TIME ZONE 'Asia/Manila';
    END IF;
    
    -- Calculate difference in seconds
    time_diff := EXTRACT(EPOCH FROM (philippines_time - last_update));
    
    -- Return absolute value to handle timezone issues
    RETURN GREATEST(0, time_diff);
END;
$$ language 'plpgsql';

-- Function to send notifications when activity data changes
CREATE OR REPLACE FUNCTION notify_activity_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Send notification with user_id, activity state, and time tracking
    PERFORM pg_notify(
        'activity_change',
        json_build_object(
            'user_id', NEW.user_id,
            'is_currently_active', NEW.is_currently_active,
            'today_active_seconds', NEW.today_active_seconds,
            'today_inactive_seconds', NEW.today_inactive_seconds,
            'last_session_start', NEW.last_session_start,
            'updated_at', NEW.updated_at
        )::text
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_activity_data_updated_at 
    BEFORE UPDATE ON activity_data 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to send notifications when activity data changes
CREATE TRIGGER notify_activity_data_change
    AFTER INSERT OR UPDATE ON activity_data
    FOR EACH ROW
    EXECUTE FUNCTION notify_activity_change(); 