-- =====================================================
-- Migration 119: Fix announcement trigger to remove announcement_type reference
-- Description: Update the notify_announcement_change function to remove announcement_type
-- =====================================================

-- Drop the trigger first, then the function
DROP TRIGGER IF EXISTS announcements_notify_trigger ON public.announcements;
DROP FUNCTION IF EXISTS notify_announcement_change();

CREATE OR REPLACE FUNCTION notify_announcement_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_payload jsonb;
BEGIN
    -- Build base notification payload
    notification_payload := jsonb_build_object(
        'table', 'announcements',
        'operation', TG_OP,
        'id', COALESCE(NEW.id, OLD.id),
        'title', COALESCE(NEW.title, OLD.title)
    );
    
    -- Add additional fields for different operations
    IF TG_OP = 'INSERT' THEN
        notification_payload := notification_payload || jsonb_build_object(
            'message', NEW.message,
            'priority', NEW.priority,
            'scheduled_at', NEW.scheduled_at
        );
    ELSIF TG_OP = 'UPDATE' THEN
        notification_payload := notification_payload || jsonb_build_object(
            'message', NEW.message,
            'priority', NEW.priority,
            'scheduled_at', NEW.scheduled_at,
            'old_title', OLD.title,
            'old_message', OLD.message
        );
    END IF;
    
    -- Send notification
    PERFORM pg_notify('announcements', notification_payload::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER announcements_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.announcements
    FOR EACH ROW
    EXECUTE FUNCTION notify_announcement_change();
