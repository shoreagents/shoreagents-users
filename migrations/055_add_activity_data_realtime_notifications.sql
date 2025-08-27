-- Migration 055: Add real-time notifications for activity_data changes
-- This will automatically notify the frontend when new rows are created or updated
-- Eliminating the need for page reloads to see updated data

-- Create the notification function
CREATE OR REPLACE FUNCTION notify_activity_data_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_data JSONB;
BEGIN
    -- Build notification payload
    notification_data := jsonb_build_object(
        'user_id', NEW.user_id,
        'action', TG_OP,
        'table', 'activity_data',
        'data', jsonb_build_object(
            'id', NEW.id,
            'user_id', NEW.user_id,
            'is_currently_active', NEW.is_currently_active,
            'today_active_seconds', NEW.today_active_seconds,
            'today_inactive_seconds', NEW.today_inactive_seconds,
            'today_date', NEW.today_date,
            'last_session_start', NEW.last_session_start,
            'created_at', NEW.created_at,
            'updated_at', NEW.updated_at
        )
    );
    
    -- Send notification to the activity_data_change channel
    PERFORM pg_notify('activity_data_change', notification_data::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON FUNCTION notify_activity_data_change() 
IS 'Sends real-time notifications when activity_data rows are created or updated';

-- Create the trigger
DROP TRIGGER IF EXISTS notify_activity_data_change ON activity_data;

CREATE TRIGGER notify_activity_data_change
    AFTER INSERT OR UPDATE ON activity_data
    FOR EACH ROW
    EXECUTE FUNCTION notify_activity_data_change();

-- Add comment for the trigger
COMMENT ON TRIGGER notify_activity_data_change ON activity_data 
IS 'Automatically notifies frontend of activity_data changes via WebSocket';
