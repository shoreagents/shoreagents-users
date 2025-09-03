-- Migration 065: Add meeting status change notifications
-- This migration adds triggers to notify when meeting status changes, particularly is_in_meeting

-- Create function to notify meeting status changes
CREATE OR REPLACE FUNCTION notify_meeting_status_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
BEGIN
    -- Only notify if is_in_meeting status changed
    IF (TG_OP = 'UPDATE' AND OLD.is_in_meeting IS DISTINCT FROM NEW.is_in_meeting) OR
       (TG_OP = 'INSERT' AND NEW.is_in_meeting = true) THEN
        
        -- Create payload with meeting and user information
        payload := json_build_object(
            'meeting_id', NEW.id,
            'agent_user_id', NEW.agent_user_id,
            'is_in_meeting', NEW.is_in_meeting,
            'status', NEW.status,
            'title', NEW.title,
            'start_time', NEW.start_time,
            'end_time', NEW.end_time,
            'operation', TG_OP,
            'timestamp', NOW()
        );
        
        -- Send notification
        PERFORM pg_notify('meeting_status_change', payload::text);
        
        -- Also send a specific notification for meeting updates
        PERFORM pg_notify('"meeting-update"', payload::text);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for meeting status changes
DROP TRIGGER IF EXISTS trigger_meeting_status_change ON public.meetings;
CREATE TRIGGER trigger_meeting_status_change
    AFTER INSERT OR UPDATE ON public.meetings
    FOR EACH ROW
    EXECUTE FUNCTION notify_meeting_status_change();

-- Create function to notify when meeting ends (status changes to completed)
CREATE OR REPLACE FUNCTION notify_meeting_end()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
BEGIN
    -- Notify when meeting status changes to completed
    IF TG_OP = 'UPDATE' AND OLD.status != 'completed' AND NEW.status = 'completed' THEN
        
        payload := json_build_object(
            'meeting_id', NEW.id,
            'agent_user_id', NEW.agent_user_id,
            'is_in_meeting', false,
            'status', NEW.status,
            'title', NEW.title,
            'start_time', NEW.start_time,
            'end_time', NEW.end_time,
            'operation', 'meeting_ended',
            'timestamp', NOW()
        );
        
        -- Send notification
        PERFORM pg_notify('meeting_status_change', payload::text);
        PERFORM pg_notify('"meeting-update"', payload::text);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for meeting end notifications
DROP TRIGGER IF EXISTS trigger_meeting_end ON public.meetings;
CREATE TRIGGER trigger_meeting_end
    AFTER UPDATE ON public.meetings
    FOR EACH ROW
    EXECUTE FUNCTION notify_meeting_end();
