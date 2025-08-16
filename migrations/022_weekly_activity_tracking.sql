-- Weekly Activity Tracking System
-- Auto-aggregates daily activity data into weekly summaries
-- Auto-deletes old daily records after weekly aggregation

-- Weekly activity summary table
CREATE TABLE IF NOT EXISTS weekly_activity_summary (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL, -- Monday of the week (Philippines timezone)
    week_end_date DATE NOT NULL,   -- Sunday of the week (Philippines timezone)
    total_active_seconds INTEGER DEFAULT 0,
    total_inactive_seconds INTEGER DEFAULT 0,
    total_days_active INTEGER DEFAULT 0, -- Count of days with activity
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, week_start_date)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_weekly_activity_user_id ON weekly_activity_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_activity_week_dates ON weekly_activity_summary(week_start_date, week_end_date);
CREATE INDEX IF NOT EXISTS idx_weekly_activity_created_at ON weekly_activity_summary(created_at);

-- Function to get week start date (Monday) in Philippines timezone
CREATE OR REPLACE FUNCTION get_week_start_date(input_date DATE DEFAULT NULL)
RETURNS DATE AS $$
DECLARE
    target_date DATE;
    week_start DATE;
BEGIN
    -- Use provided date or current Philippines date
    IF input_date IS NULL THEN
        target_date := (NOW() AT TIME ZONE 'Asia/Manila')::date;
    ELSE
        target_date := input_date;
    END IF;
    
    -- Get Monday of the week (week starts on Monday)
    week_start := target_date - (EXTRACT(DOW FROM target_date) - 1)::INTEGER;
    
    -- Adjust for Sunday (DOW = 0)
    IF EXTRACT(DOW FROM target_date) = 0 THEN
        week_start := target_date - 6;
    END IF;
    
    RETURN week_start;
END;
$$ language 'plpgsql';

-- Function to get week end date (Sunday) in Philippines timezone
CREATE OR REPLACE FUNCTION get_week_end_date(input_date DATE DEFAULT NULL)
RETURNS DATE AS $$
BEGIN
    -- Return Sunday of the week
    RETURN get_week_start_date(input_date) + 6;
END;
$$ language 'plpgsql';

-- Function to aggregate daily activity into weekly summary
CREATE OR REPLACE FUNCTION aggregate_weekly_activity(target_date DATE DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    week_start DATE;
    week_end DATE;
    user_record RECORD;
    weekly_record RECORD;
    total_active INTEGER;
    total_inactive INTEGER;
    days_active INTEGER;
BEGIN
    -- Get week dates
    week_start := get_week_start_date(target_date);
    week_end := get_week_end_date(target_date);
    
    -- Loop through all users
    FOR user_record IN 
        SELECT DISTINCT user_id FROM activity_data 
        WHERE today_date BETWEEN week_start AND week_end
    LOOP
        -- Calculate totals for this user in this week
        SELECT 
            COALESCE(SUM(today_active_seconds), 0) as total_active,
            COALESCE(SUM(today_inactive_seconds), 0) as total_inactive,
            COUNT(*) as days_active
        INTO total_active, total_inactive, days_active
        FROM activity_data 
        WHERE user_id = user_record.user_id 
        AND today_date BETWEEN week_start AND week_end;
        
        -- Check if weekly record exists
        SELECT * INTO weekly_record 
        FROM weekly_activity_summary 
        WHERE user_id = user_record.user_id AND week_start_date = week_start;
        
        IF FOUND THEN
            -- Update existing weekly record
            UPDATE weekly_activity_summary 
            SET 
                total_active_seconds = total_active,
                total_inactive_seconds = total_inactive,
                total_days_active = days_active,
                updated_at = NOW()
            WHERE user_id = user_record.user_id AND week_start_date = week_start;
        ELSE
            -- Create new weekly record
            INSERT INTO weekly_activity_summary (
                user_id, week_start_date, week_end_date,
                total_active_seconds, total_inactive_seconds, total_days_active
            ) VALUES (
                user_record.user_id, week_start, week_end,
                total_active, total_inactive, days_active
            );
        END IF;
    END LOOP;
END;
$$ language 'plpgsql';

-- Function to cleanup old daily activity data after weekly aggregation
CREATE OR REPLACE FUNCTION cleanup_old_daily_activity(weeks_to_keep INTEGER DEFAULT 1)
RETURNS INTEGER AS $$
DECLARE
    cutoff_date DATE;
    deleted_count INTEGER;
BEGIN
    -- Calculate cutoff date (keep only recent weeks)
    cutoff_date := get_week_start_date() - (weeks_to_keep * 7);
    
    -- Delete old daily activity records
    DELETE FROM activity_data 
    WHERE today_date < cutoff_date;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Function to get weekly summary for a user
CREATE OR REPLACE FUNCTION get_user_weekly_summary(
    target_user_id INTEGER,
    target_date DATE DEFAULT NULL
)
RETURNS TABLE (
    week_start_date DATE,
    week_end_date DATE,
    total_active_seconds INTEGER,
    total_inactive_seconds INTEGER,
    total_days_active INTEGER,
    total_hours_active NUMERIC,
    total_hours_inactive NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        was.week_start_date,
        was.week_end_date,
        was.total_active_seconds,
        was.total_inactive_seconds,
        was.total_days_active,
        ROUND(was.total_active_seconds::NUMERIC / 3600, 2) as total_hours_active,
        ROUND(was.total_inactive_seconds::NUMERIC / 3600, 2) as total_hours_inactive
    FROM weekly_activity_summary was
    WHERE was.user_id = target_user_id
    AND (target_date IS NULL OR 
         (was.week_start_date <= target_date AND was.week_end_date >= target_date))
    ORDER BY was.week_start_date DESC;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at column
CREATE TRIGGER update_weekly_activity_updated_at 
    BEFORE UPDATE ON weekly_activity_summary 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 