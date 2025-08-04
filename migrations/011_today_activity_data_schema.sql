-- Create today_activity_data table for tracking daily activity metrics
CREATE TABLE IF NOT EXISTS today_activity_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Manila'::text)::date,
    total_active_time INTEGER DEFAULT 0, -- Total active time in seconds
    total_inactive_time INTEGER DEFAULT 0, -- Total inactive time in seconds
    inactivity_count INTEGER DEFAULT 0, -- Number of times user went inactive
    last_active_session_start TIMESTAMP DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text),
    last_inactive_session_start TIMESTAMP DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text),
    created_at TIMESTAMP DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text),
    updated_at TIMESTAMP DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC'::text) AT TIME ZONE 'Asia/Manila'::text),
    UNIQUE(user_id, date)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_today_activity_data_user_date ON today_activity_data(user_id, date);
CREATE INDEX IF NOT EXISTS idx_today_activity_data_date ON today_activity_data(date);

-- Create function to update the updated_at column
CREATE OR REPLACE FUNCTION update_today_activity_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = (NOW() AT TIME ZONE 'Asia/Manila');
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_today_activity_data_updated_at 
    BEFORE UPDATE ON today_activity_data 
    FOR EACH ROW 
    EXECUTE FUNCTION update_today_activity_updated_at();

-- Create function to get or create today's activity record
CREATE OR REPLACE FUNCTION get_or_create_today_activity(user_id_param INTEGER)
RETURNS today_activity_data AS $$
DECLARE
    activity_record today_activity_data;
BEGIN
    -- Try to get existing record for today (using Philippines timezone)
    SELECT * INTO activity_record 
    FROM today_activity_data 
    WHERE user_id = user_id_param AND date = (now() AT TIME ZONE 'Asia/Manila'::text)::date;
    
    -- If no record exists, create one
    IF NOT FOUND THEN
        INSERT INTO today_activity_data (user_id, date, total_active_time, total_inactive_time, inactivity_count)
        VALUES (user_id_param, (now() AT TIME ZONE 'Asia/Manila'::text)::date, 0, 0, 0)
        RETURNING * INTO activity_record;
    END IF;
    
    RETURN activity_record;
END;
$$ LANGUAGE plpgsql;

-- Create function to update activity time
CREATE OR REPLACE FUNCTION update_activity_time(
    user_id_param INTEGER,
    is_active BOOLEAN,
    session_duration_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    activity_record today_activity_data;
BEGIN
    -- Get or create today's activity record
    SELECT * INTO activity_record FROM get_or_create_today_activity(user_id_param);
    
    IF is_active THEN
        -- User became active, update active time and session start
        UPDATE today_activity_data 
        SET 
            total_active_time = total_active_time + session_duration_seconds,
            last_active_session_start = (now() AT TIME ZONE 'Asia/Manila'::text),
            updated_at = (now() AT TIME ZONE 'Asia/Manila'::text)
        WHERE id = activity_record.id;
    ELSE
        -- User became inactive, update inactive time, increment count, and session start
        UPDATE today_activity_data 
        SET 
            total_inactive_time = total_inactive_time + session_duration_seconds,
            inactivity_count = inactivity_count + 1,
            last_inactive_session_start = (now() AT TIME ZONE 'Asia/Manila'::text),
            updated_at = (now() AT TIME ZONE 'Asia/Manila'::text)
        WHERE id = activity_record.id;
    END IF;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql; 