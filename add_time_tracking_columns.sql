-- Add time tracking columns to activity_data table
-- Run this manually in your database

-- Add new columns to activity_data table
ALTER TABLE activity_data 
ADD COLUMN IF NOT EXISTS today_active_seconds INTEGER DEFAULT 0;

ALTER TABLE activity_data 
ADD COLUMN IF NOT EXISTS today_inactive_seconds INTEGER DEFAULT 0;

ALTER TABLE activity_data 
ADD COLUMN IF NOT EXISTS last_session_start TIMESTAMP WITH TIME ZONE;

-- Update the notification function to include time tracking data
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