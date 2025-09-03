-- Migration: Add real-time trigger for ticket changes
-- This migration adds a trigger to notify clients when tickets are updated
-- This fixes the issue where manual database updates don't trigger real-time UI updates

-- Create function to notify ticket changes
CREATE OR REPLACE FUNCTION notify_ticket_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
  user_email TEXT;
  category_name TEXT;
BEGIN
  -- Get user email and category name for the ticket
  SELECT u.email, tc.name
  INTO user_email, category_name
  FROM users u
  LEFT JOIN ticket_categories tc ON tc.id = COALESCE(NEW.category_id, OLD.category_id)
  WHERE u.id = COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP = 'INSERT' THEN
    payload := json_build_object(
      'table', 'tickets',
      'action', 'INSERT',
      'record', json_build_object(
        'id', NEW.id,
        'ticket_id', NEW.ticket_id,
        'user_id', NEW.user_id,
        'concern', NEW.concern,
        'details', NEW.details,
        'status', NEW.status,
        'category_id', NEW.category_id,
        'position', NEW.position,
        'file_count', NEW.file_count,
        'supporting_files', NEW.supporting_files,
        'created_at', NEW.created_at,
        'updated_at', NEW.updated_at,
        'user_email', user_email,
        'category_name', category_name
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    payload := json_build_object(
      'table', 'tickets',
      'action', 'UPDATE',
      'record', json_build_object(
        'id', NEW.id,
        'ticket_id', NEW.ticket_id,
        'user_id', NEW.user_id,
        'concern', NEW.concern,
        'details', NEW.details,
        'status', NEW.status,
        'category_id', NEW.category_id,
        'position', NEW.position,
        'file_count', NEW.file_count,
        'supporting_files', NEW.supporting_files,
        'created_at', NEW.created_at,
        'updated_at', NEW.updated_at,
        'user_email', user_email,
        'category_name', category_name
      ),
      'old_record', json_build_object(
        'id', OLD.id,
        'ticket_id', OLD.ticket_id,
        'user_id', OLD.user_id,
        'concern', OLD.concern,
        'details', OLD.details,
        'status', OLD.status,
        'category_id', OLD.category_id,
        'position', OLD.position,
        'file_count', OLD.file_count,
        'supporting_files', OLD.supporting_files,
        'created_at', OLD.created_at,
        'updated_at', OLD.updated_at
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    payload := json_build_object(
      'table', 'tickets',
      'action', 'DELETE',
      'old_record', json_build_object(
        'id', OLD.id,
        'ticket_id', OLD.ticket_id,
        'user_id', OLD.user_id,
        'concern', OLD.concern,
        'details', OLD.details,
        'status', OLD.status,
        'category_id', OLD.category_id,
        'position', OLD.position,
        'file_count', OLD.file_count,
        'supporting_files', OLD.supporting_files,
        'created_at', OLD.created_at,
        'updated_at', OLD.updated_at
      )
    );
  END IF;

  -- Send notification to ticket_changes channel
  PERFORM pg_notify('ticket_changes', payload::text);
  
  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for ticket changes
DROP TRIGGER IF EXISTS ticket_changes_notify_insert ON public.tickets;
CREATE TRIGGER ticket_changes_notify_insert
  AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION notify_ticket_change();

DROP TRIGGER IF EXISTS ticket_changes_notify_update ON public.tickets;
CREATE TRIGGER ticket_changes_notify_update
  AFTER UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION notify_ticket_change();

DROP TRIGGER IF EXISTS ticket_changes_notify_delete ON public.tickets;
CREATE TRIGGER ticket_changes_notify_delete
  AFTER DELETE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION notify_ticket_change();

-- Add comments for documentation
COMMENT ON FUNCTION notify_ticket_change() IS 'Notifies clients of ticket changes via pg_notify for real-time updates';
COMMENT ON TRIGGER ticket_changes_notify_insert ON tickets IS 'Triggers real-time notification when a new ticket is created';
COMMENT ON TRIGGER ticket_changes_notify_update ON tickets IS 'Triggers real-time notification when a ticket is updated';
COMMENT ON TRIGGER ticket_changes_notify_delete ON tickets IS 'Triggers real-time notification when a ticket is deleted';
