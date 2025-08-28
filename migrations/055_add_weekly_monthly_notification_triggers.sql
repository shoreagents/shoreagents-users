-- Add Notification Triggers for Weekly and Monthly Activity Changes
-- This migration creates triggers that send NOTIFY events when weekly/monthly activity data changes
-- allowing the frontend to receive real-time updates without making POST requests

-- Function to send notification when weekly activity changes
CREATE OR REPLACE FUNCTION notify_weekly_activity_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Send notification with user_id and action type
    PERFORM pg_notify(
        'weekly_activity_change',
        json_build_object(
            'user_id', NEW.user_id,
            'action', CASE 
                WHEN TG_OP = 'INSERT' THEN 'inserted'
                WHEN TG_OP = 'UPDATE' THEN 'updated'
                WHEN TG_OP = 'DELETE' THEN 'deleted'
            END,
            'week_start_date', COALESCE(NEW.week_start_date, OLD.week_start_date),
            'week_end_date', COALESCE(NEW.week_end_date, OLD.week_end_date),
            'total_active_seconds', COALESCE(NEW.total_active_seconds, OLD.total_active_seconds),
            'total_inactive_seconds', COALESCE(NEW.total_inactive_seconds, OLD.total_inactive_seconds),
            'total_days_active', COALESCE(NEW.total_days_active, OLD.total_days_active),
            'timestamp', NOW()
        )::text
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to send notification when monthly activity changes
CREATE OR REPLACE FUNCTION notify_monthly_activity_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Send notification with user_id and action type
    PERFORM pg_notify(
        'monthly_activity_change',
        json_build_object(
            'user_id', NEW.user_id,
            'action', CASE 
                WHEN TG_OP = 'INSERT' THEN 'inserted'
                WHEN TG_OP = 'UPDATE' THEN 'updated'
                WHEN TG_OP = 'DELETE' THEN 'deleted'
            END,
            'month_start_date', COALESCE(NEW.month_start_date, OLD.month_start_date),
            'month_end_date', COALESCE(NEW.month_end_date, OLD.month_end_date),
            'total_active_seconds', COALESCE(NEW.total_active_seconds, OLD.total_active_seconds),
            'total_inactive_seconds', COALESCE(NEW.total_inactive_seconds, OLD.total_inactive_seconds),
            'total_days_active', COALESCE(NEW.total_days_active, OLD.total_days_active),
            'timestamp', NOW()
        )::text
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for weekly activity notifications
CREATE TRIGGER trg_notify_weekly_activity_insert
    AFTER INSERT ON weekly_activity_summary
    FOR EACH ROW
    EXECUTE FUNCTION notify_weekly_activity_change();

CREATE TRIGGER trg_notify_weekly_activity_update
    AFTER UPDATE ON weekly_activity_summary
    FOR EACH ROW
    EXECUTE FUNCTION notify_weekly_activity_change();

CREATE TRIGGER trg_notify_weekly_activity_delete
    AFTER DELETE ON weekly_activity_summary
    FOR EACH ROW
    EXECUTE FUNCTION notify_weekly_activity_change();

-- Create triggers for monthly activity notifications
CREATE TRIGGER trg_notify_monthly_activity_insert
    AFTER INSERT ON monthly_activity_summary
    FOR EACH ROW
    EXECUTE FUNCTION notify_monthly_activity_change();

CREATE TRIGGER trg_notify_monthly_activity_update
    AFTER UPDATE ON monthly_activity_summary
    FOR EACH ROW
    EXECUTE FUNCTION notify_monthly_activity_change();

CREATE TRIGGER trg_notify_monthly_activity_delete
    AFTER DELETE ON monthly_activity_summary
    FOR EACH ROW
    EXECUTE FUNCTION notify_monthly_activity_change();

-- Add comments for documentation
COMMENT ON FUNCTION notify_weekly_activity_change() IS 
'Sends NOTIFY events when weekly activity data changes, enabling real-time frontend updates.';

COMMENT ON FUNCTION notify_monthly_activity_change() IS 
'Sends NOTIFY events when monthly activity data changes, enabling real-time frontend updates.';

-- Log the completion of this migration
DO $$
BEGIN
    RAISE LOG 'Migration 055_add_weekly_monthly_notification_triggers completed successfully. 
               Notification triggers are now active for weekly and monthly activity changes.';
END $$;
