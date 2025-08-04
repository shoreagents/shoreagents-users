-- Productivity Scoring System
-- Calculates monthly productivity scores based on active vs inactive time
-- Stores scores with month_year format for easy querying

-- Productivity scores table
CREATE TABLE IF NOT EXISTS productivity_scores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month_year VARCHAR(7) NOT NULL, -- Format: '2025-08' (YYYY-MM)
    productivity_score DECIMAL(5,2) NOT NULL, -- Score from 0.00 to 100.00
    total_active_seconds INTEGER DEFAULT 0,
    total_inactive_seconds INTEGER DEFAULT 0,
    total_seconds INTEGER DEFAULT 0,
    active_percentage DECIMAL(5,2) DEFAULT 0.00, -- Percentage of active time
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, month_year)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_productivity_user_id ON productivity_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_productivity_month_year ON productivity_scores(month_year);
CREATE INDEX IF NOT EXISTS idx_productivity_score ON productivity_scores(productivity_score);
CREATE INDEX IF NOT EXISTS idx_productivity_created_at ON productivity_scores(created_at);

-- Function to calculate productivity score
-- Formula: (active_time / total_time) * 100
-- Higher score = more productive (more active time)
CREATE OR REPLACE FUNCTION calculate_productivity_score(
    active_seconds INTEGER,
    inactive_seconds INTEGER
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    total_seconds INTEGER;
    active_percentage DECIMAL(5,2);
    productivity_score DECIMAL(5,2);
BEGIN
    -- Calculate total seconds
    total_seconds := active_seconds + inactive_seconds;
    
    -- Avoid division by zero
    IF total_seconds = 0 THEN
        RETURN 0.00;
    END IF;
    
    -- Calculate active percentage
    active_percentage := (active_seconds::DECIMAL / total_seconds::DECIMAL) * 100;
    
    -- Productivity score is the same as active percentage
    -- You can modify this formula for different scoring logic
    productivity_score := active_percentage;
    
    -- Ensure score is between 0 and 100
    IF productivity_score > 100 THEN
        productivity_score := 100.00;
    ELSIF productivity_score < 0 THEN
        productivity_score := 0.00;
    END IF;
    
    RETURN ROUND(productivity_score, 2);
END;
$$ language 'plpgsql';

-- Function to get month_year string from date
CREATE OR REPLACE FUNCTION get_month_year(input_date DATE DEFAULT NULL)
RETURNS VARCHAR(7) AS $$
DECLARE
    target_date DATE;
    month_year VARCHAR(7);
BEGIN
    -- Use provided date or current Philippines date
    IF input_date IS NULL THEN
        target_date := (NOW() AT TIME ZONE 'Asia/Manila')::date;
    ELSE
        target_date := input_date;
    END IF;
    
    -- Format as YYYY-MM
    month_year := TO_CHAR(target_date, 'YYYY-MM');
    
    RETURN month_year;
END;
$$ language 'plpgsql';

-- Function to calculate and store productivity score for a month
CREATE OR REPLACE FUNCTION calculate_monthly_productivity_score(
    target_user_id INTEGER,
    target_month_year VARCHAR(7) DEFAULT NULL
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    month_start DATE;
    month_end DATE;
    total_active INTEGER;
    total_inactive INTEGER;
    total_seconds INTEGER;
    active_percentage DECIMAL(5,2);
    productivity_score DECIMAL(5,2);
    month_year_str VARCHAR(7);
BEGIN
    -- Get month_year string
    IF target_month_year IS NULL THEN
        month_year_str := get_month_year();
    ELSE
        month_year_str := target_month_year;
    END IF;
    
    -- Convert month_year to start/end dates
    month_start := TO_DATE(month_year_str || '-01', 'YYYY-MM-DD');
    month_end := (month_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
    
    -- Get total active and inactive seconds for the month
    SELECT 
        COALESCE(SUM(today_active_seconds), 0) as total_active,
        COALESCE(SUM(today_inactive_seconds), 0) as total_inactive
    INTO total_active, total_inactive
    FROM activity_data 
    WHERE user_id = target_user_id 
    AND today_date BETWEEN month_start AND month_end;
    
    -- Calculate productivity score
    productivity_score := calculate_productivity_score(total_active, total_inactive);
    
    -- Calculate percentages
    total_seconds := total_active + total_inactive;
    IF total_seconds > 0 THEN
        active_percentage := (total_active::DECIMAL / total_seconds::DECIMAL) * 100;
    ELSE
        active_percentage := 0.00;
    END IF;
    
    -- Insert or update productivity score
    INSERT INTO productivity_scores (
        user_id, month_year, productivity_score,
        total_active_seconds, total_inactive_seconds, total_seconds, active_percentage
    ) VALUES (
        target_user_id, month_year_str, productivity_score,
        total_active, total_inactive, total_seconds, active_percentage
    )
    ON CONFLICT (user_id, month_year) 
    DO UPDATE SET
        productivity_score = EXCLUDED.productivity_score,
        total_active_seconds = EXCLUDED.total_active_seconds,
        total_inactive_seconds = EXCLUDED.total_inactive_seconds,
        total_seconds = EXCLUDED.total_seconds,
        active_percentage = EXCLUDED.active_percentage,
        updated_at = NOW();
    
    RETURN productivity_score;
END;
$$ language 'plpgsql';

-- Function to get user productivity scores
CREATE OR REPLACE FUNCTION get_user_productivity_scores(
    target_user_id INTEGER,
    months_back INTEGER DEFAULT 12
)
RETURNS TABLE (
    month_year VARCHAR(7),
    productivity_score DECIMAL(5,2),
    total_active_seconds INTEGER,
    total_inactive_seconds INTEGER,
    total_seconds INTEGER,
    active_percentage DECIMAL(5,2),
    active_hours DECIMAL(5,2),
    inactive_hours DECIMAL(5,2),
    total_hours DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ps.month_year,
        ps.productivity_score,
        ps.total_active_seconds,
        ps.total_inactive_seconds,
        ps.total_seconds,
        ps.active_percentage,
        ROUND(ps.total_active_seconds::DECIMAL / 3600, 2) as active_hours,
        ROUND(ps.total_inactive_seconds::DECIMAL / 3600, 2) as inactive_hours,
        ROUND(ps.total_seconds::DECIMAL / 3600, 2) as total_hours
    FROM productivity_scores ps
    WHERE ps.user_id = target_user_id
    ORDER BY ps.month_year DESC
    LIMIT months_back;
END;
$$ language 'plpgsql';

-- Function to get average productivity score for a user
CREATE OR REPLACE FUNCTION get_user_average_productivity(
    target_user_id INTEGER,
    months_back INTEGER DEFAULT 12
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    avg_score DECIMAL(5,2);
    cutoff_date DATE;
BEGIN
    -- Calculate cutoff date (months_back months ago)
    cutoff_date := (NOW() AT TIME ZONE 'Asia/Manila')::date - (months_back * 30);
    
    SELECT AVG(productivity_score) INTO avg_score
    FROM productivity_scores 
    WHERE user_id = target_user_id
    AND month_year >= TO_CHAR(cutoff_date, 'YYYY-MM');
    
    RETURN COALESCE(ROUND(avg_score, 2), 0.00);
END;
$$ language 'plpgsql';

-- Trigger to update updated_at column
CREATE TRIGGER update_productivity_scores_updated_at 
    BEFORE UPDATE ON productivity_scores 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 