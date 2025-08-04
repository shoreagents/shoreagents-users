-- Drop Activity Tracking Schema
-- This script drops all tables and functions created in migration 008

-- Drop triggers first (they depend on tables)
DROP TRIGGER IF EXISTS update_user_activity_sessions_updated_at ON user_activity_sessions;
DROP TRIGGER IF EXISTS update_user_activity_daily_updated_at ON user_activity_daily;
DROP TRIGGER IF EXISTS update_user_activity_weekly_updated_at ON user_activity_weekly;
DROP TRIGGER IF EXISTS update_user_activity_monthly_updated_at ON user_activity_monthly;
DROP TRIGGER IF EXISTS update_user_activity_hourly_updated_at ON user_activity_hourly;
DROP TRIGGER IF EXISTS update_user_current_session_updated_at ON user_current_session;

-- Drop tables
DROP TABLE IF EXISTS user_activity_sessions CASCADE;
DROP TABLE IF EXISTS user_activity_daily CASCADE;
DROP TABLE IF EXISTS user_activity_weekly CASCADE;
DROP TABLE IF EXISTS user_activity_monthly CASCADE;
DROP TABLE IF EXISTS user_activity_hourly CASCADE;
DROP TABLE IF EXISTS user_current_session CASCADE;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop indexes (they will be dropped with tables, but explicit for clarity)
DROP INDEX IF EXISTS idx_user_activity_sessions_user_id;
DROP INDEX IF EXISTS idx_user_activity_sessions_start_time;
DROP INDEX IF EXISTS idx_user_activity_daily_user_id_date;
DROP INDEX IF EXISTS idx_user_activity_weekly_user_id_week;
DROP INDEX IF EXISTS idx_user_activity_monthly_user_id_month;
DROP INDEX IF EXISTS idx_user_activity_hourly_user_id_date_hour;
DROP INDEX IF EXISTS idx_user_current_session_user_id; 