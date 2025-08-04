-- Drop Today Activity Data Schema
-- This script drops all tables and functions created in migration 011

-- Drop triggers first (they depend on tables)
DROP TRIGGER IF EXISTS update_today_activity_data_updated_at ON today_activity_data;

-- Drop functions
DROP FUNCTION IF EXISTS get_current_session_duration(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS update_activity_state(INTEGER, BOOLEAN, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS get_or_create_today_activity(INTEGER) CASCADE;

-- Drop tables
DROP TABLE IF EXISTS today_activity_data CASCADE;

-- Drop indexes (they will be dropped with tables, but explicit for clarity)
DROP INDEX IF EXISTS idx_today_activity_data_user_id_date;
DROP INDEX IF EXISTS idx_today_activity_data_date; 