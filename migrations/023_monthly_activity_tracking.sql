-- Monthly Activity Tracking System
-- Auto-aggregates daily activity data into monthly summaries
-- Auto-deletes old daily records after monthly aggregation

-- Monthly activity summary table
CREATE TABLE IF NOT EXISTS monthly_activity_summary (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_start_date DATE NOT NULL, -- 1st day of the month (Philippines timezone)
    month_end_date DATE NOT NULL,   -- Last day of the month (Philippines timezone)
    total_active_seconds INTEGER DEFAULT 0,
    total_inactive_seconds INTEGER DEFAULT 0,
    total_days_active INTEGER DEFAULT 0, -- Count of days with activity
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, month_start_date)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_monthly_activity_user_id ON monthly_activity_summary(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_activity_month_dates ON monthly_activity_summary(month_start_date, month_end_date);
CREATE INDEX IF NOT EXISTS idx_monthly_activity_created_at ON monthly_activity_summary(created_at);

-- Function to get month start date (1st day) in Philippines timezone
CREATE OR REPLACE FUNCTION get_month_start_date(input_date DATE DEFAULT NULL)
RETURNS DATE AS $$
DECLARE
    target_date DATE;
    month_start DATE;
BEGIN
    -- Use provided date or current Philippines date
    IF input_date IS NULL THEN
        target_date := (NOW() AT TIME ZONE 'Asia/Manila')::date;
    ELSE
        target_date := input_date;
    END IF;
    
    -- Get 1st day of the month
    month_start := DATE_TRUNC('month', target_date)::date;
    
    RETURN month_start;
END;
$$ language 'plpgsql';

-- Function to get month end date (last day) in Philippines timezone
CREATE OR REPLACE FUNCTION get_month_end_date(input_date DATE DEFAULT NULL)
RETURNS DATE AS $$
DECLARE
    target_date DATE;
    month_end DATE;
BEGIN
    -- Use provided date or current Philippines date
    IF input_date IS NULL THEN
        target_date := (NOW() AT TIME ZONE 'Asia/Manila')::date;
    ELSE
        target_date := input_date;
    END IF;
    
    -- Get last day of the month
    month_end := (DATE_TRUNC('month', target_date) + INTERVAL '1 month' - INTERVAL '1 day')::date;
    
    RETURN month_end;
END;
$$ language 'plpgsql';

-- Function to aggregate daily activity into monthly summary
CREATE OR REPLACE FUNCTION aggregate_monthly_activity(target_date DATE DEFAULT NULL)
RETURNS VOID AS $$
DECLARE
    month_start DATE;
    month_end DATE;
    user_record RECORD;
    monthly_record RECORD;
    total_active INTEGER;
    total_inactive INTEGER;
    days_active INTEGER;
BEGIN
    -- Get month dates
    month_start := get_month_start_date(target_date);
    month_end := get_month_end_date(target_date);
    
    -- Loop through all users
    FOR user_record IN 
        SELECT DISTINCT user_id FROM activity_data 
        WHERE today_date BETWEEN month_start AND month_end
    LOOP
        -- Calculate totals for this user in this month
        SELECT 
            COALESCE(SUM(today_active_seconds), 0) as total_active,
            COALESCE(SUM(today_inactive_seconds), 0) as total_inactive,
            COUNT(*) as days_active
        INTO total_active, total_inactive, days_active
        FROM activity_data 
        WHERE user_id = user_record.user_id 
        AND today_date BETWEEN month_start AND month_end;
        
        -- Check if monthly record exists
        SELECT * INTO monthly_record 
        FROM monthly_activity_summary 
        WHERE user_id = user_record.user_id AND month_start_date = month_start;
        
        IF FOUND THEN
            -- Update existing monthly record
            UPDATE monthly_activity_summary 
            SET 
                total_active_seconds = total_active,
                total_inactive_seconds = total_inactive,
                total_days_active = days_active,
                updated_at = NOW()
            WHERE user_id = user_record.user_id AND month_start_date = month_start;
        ELSE
            -- Create new monthly record
            INSERT INTO monthly_activity_summary (
                user_id, month_start_date, month_end_date,
                total_active_seconds, total_inactive_seconds, total_days_active
            ) VALUES (
                user_record.user_id, month_start, month_end,
                total_active, total_inactive, days_active
            );
        END IF;
    END LOOP;
END;
$$ language 'plpgsql';

-- Function to cleanup old daily activity data after monthly aggregation
CREATE OR REPLACE FUNCTION cleanup_old_daily_activity_monthly(months_to_keep INTEGER DEFAULT 1)
RETURNS INTEGER AS $$
DECLARE
    cutoff_date DATE;
    deleted_count INTEGER;
BEGIN
    -- Calculate cutoff date (keep only recent months)
    cutoff_date := get_month_start_date() - (months_to_keep * 30);
    
    -- Delete old daily activity records
    DELETE FROM activity_data 
    WHERE today_date < cutoff_date;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Function to get monthly summary for a user
CREATE OR REPLACE FUNCTION get_user_monthly_summary(
    target_user_id INTEGER,
    target_date DATE DEFAULT NULL
)
RETURNS TABLE (
    month_start_date DATE,
    month_end_date DATE,
    total_active_seconds INTEGER,
    total_inactive_seconds INTEGER,
    total_days_active INTEGER,
    total_hours_active NUMERIC,
    total_hours_inactive NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mas.month_start_date,
        mas.month_end_date,
        mas.total_active_seconds,
        mas.total_inactive_seconds,
        mas.total_days_active,
        ROUND(mas.total_active_seconds::NUMERIC / 3600, 2) as total_hours_active,
        ROUND(mas.total_inactive_seconds::NUMERIC / 3600, 2) as total_hours_inactive
    FROM monthly_activity_summary mas
    WHERE mas.user_id = target_user_id
    AND (target_date IS NULL OR 
         (mas.month_start_date <= target_date AND mas.month_end_date >= target_date))
    ORDER BY mas.month_start_date DESC;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at column
CREATE TRIGGER update_monthly_activity_updated_at 
    BEFORE UPDATE ON monthly_activity_summary 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 