-- Drop all functions, triggers, and tables related to today_activity_data

-- Drop the update_activity_time function
DROP FUNCTION IF EXISTS update_activity_time(INTEGER, BOOLEAN, INTEGER);

-- Drop the get_or_create_today_activity function
DROP FUNCTION IF EXISTS get_or_create_today_activity(INTEGER);

-- Drop the update_today_activity_updated_at function
DROP FUNCTION IF EXISTS update_today_activity_updated_at();

-- Drop the trigger for today_activity_data
DROP TRIGGER IF EXISTS update_today_activity_data_updated_at ON today_activity_data;

-- Drop indexes
DROP INDEX IF EXISTS idx_today_activity_data_user_date;
DROP INDEX IF EXISTS idx_today_activity_data_date;

-- Drop the today_activity_data table
DROP TABLE IF EXISTS today_activity_data CASCADE; 