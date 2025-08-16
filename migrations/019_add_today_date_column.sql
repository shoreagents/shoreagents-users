-- Add today_date column to activity_data table for daily tracking
-- This allows tracking activity data per day with separate rows

-- Add today_date column
ALTER TABLE activity_data 
ADD COLUMN IF NOT EXISTS today_date DATE DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')::date;

-- Update existing rows to have today_date (Philippines timezone)
UPDATE activity_data 
SET today_date = (NOW() AT TIME ZONE 'Asia/Manila')::date 
WHERE today_date IS NULL;

-- Note: Foreign key constraint activity_data_user_id_fkey already exists
-- This allows us to keep the existing foreign key relationship

-- Make today_date NOT NULL after updating existing data
ALTER TABLE activity_data 
ALTER COLUMN today_date SET NOT NULL;

-- Update the unique constraint to include today_date
-- This allows multiple rows per user (one per day)
-- Drop any existing unique constraints on user_id only
ALTER TABLE activity_data 
DROP CONSTRAINT IF EXISTS activity_data_user_id_key;

-- Add new unique constraint for user_id + today_date combination (if it doesn't exist)
-- This allows multiple rows per user (one per day) while keeping the existing foreign key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'activity_data_user_date_unique'
    ) THEN
        ALTER TABLE activity_data 
        ADD CONSTRAINT activity_data_user_date_unique 
        UNIQUE(user_id, today_date);
    END IF;
END $$;

-- Create index for better performance on date queries
CREATE INDEX IF NOT EXISTS idx_activity_data_user_date 
ON activity_data(user_id, today_date);

-- Create index for date-only queries
CREATE INDEX IF NOT EXISTS idx_activity_data_today_date 
ON activity_data(today_date);

-- Update the notification function to include today_date
-- Only send notifications for significant changes to reduce logging
CREATE OR REPLACE FUNCTION notify_activity_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only send notification if there's a significant change (more than 5 seconds difference)
    IF (OLD.today_active_seconds IS DISTINCT FROM NEW.today_active_seconds AND 
        ABS(COALESCE(NEW.today_active_seconds, 0) - COALESCE(OLD.today_active_seconds, 0)) > 5) OR 
       (OLD.today_inactive_seconds IS DISTINCT FROM NEW.today_inactive_seconds AND 
        ABS(COALESCE(NEW.today_inactive_seconds, 0) - COALESCE(OLD.today_inactive_seconds, 0)) > 5) OR
       OLD.is_currently_active IS DISTINCT FROM NEW.is_currently_active THEN
        
        PERFORM pg_notify(
            'activity_change',
            json_build_object(
                'user_id', NEW.user_id,
                'is_currently_active', NEW.is_currently_active,
                'today_active_seconds', NEW.today_active_seconds,
                'today_inactive_seconds', NEW.today_inactive_seconds,
                'last_session_start', NEW.last_session_start,
                'today_date', NEW.today_date,
                'updated_at', NEW.updated_at
            )::text
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to get or create activity data for a specific date
CREATE OR REPLACE FUNCTION get_or_create_activity_data(
    p_user_id INTEGER,
    p_date DATE DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')::date
)
RETURNS activity_data AS $$
DECLARE
    activity_record activity_data;
BEGIN
    -- Try to get existing record for the user and date
    SELECT * INTO activity_record 
    FROM activity_data 
    WHERE user_id = p_user_id AND today_date = p_date;
    
    -- If no record exists, create one
    IF NOT FOUND THEN
        INSERT INTO activity_data (
            user_id, 
            is_currently_active, 
            today_active_seconds, 
            today_inactive_seconds, 
            last_session_start, 
            today_date
        ) VALUES (
            p_user_id, 
            false, 
            0, 
            0, 
            NULL, 
            p_date
        ) RETURNING * INTO activity_record;
    END IF;
    
    RETURN activity_record;
END;
$$ language 'plpgsql';

-- Function to get daily activity summary
CREATE OR REPLACE FUNCTION get_daily_activity_summary(
    p_user_id INTEGER,
    p_start_date DATE DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '30 days',
    p_end_date DATE DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')::date
)
RETURNS TABLE (
    date DATE,
    active_hours DECIMAL(10,2),
    inactive_hours DECIMAL(10,2),
    total_hours DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ad.today_date as date,
        ROUND(ad.today_active_seconds / 3600.0, 2) as active_hours,
        ROUND(ad.today_inactive_seconds / 3600.0, 2) as inactive_hours,
        ROUND((ad.today_active_seconds + ad.today_inactive_seconds) / 3600.0, 2) as total_hours
    FROM activity_data ad
    WHERE ad.user_id = p_user_id 
    AND ad.today_date BETWEEN p_start_date AND p_end_date
    ORDER BY ad.today_date DESC;
END;
$$ language 'plpgsql';

-- Function to get current day's activity data
CREATE OR REPLACE FUNCTION get_current_day_activity(
    p_user_id INTEGER
)
RETURNS activity_data AS $$
DECLARE
    activity_record activity_data;
BEGIN
    -- Get or create activity data for today (Philippines timezone)
    SELECT * INTO activity_record 
    FROM get_or_create_activity_data(p_user_id, (NOW() AT TIME ZONE 'Asia/Manila')::date);
    
    RETURN activity_record;
END;
$$ language 'plpgsql'; 