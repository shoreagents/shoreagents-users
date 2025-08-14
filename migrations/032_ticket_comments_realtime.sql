-- Realtime NOTIFY/LISTEN for ticket_comments

-- Function: notify_ticket_comment_change
CREATE OR REPLACE FUNCTION notify_ticket_comment_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  IF TG_OP = 'INSERT' THEN
    payload := json_build_object(
      'event', 'insert',
      'comment_id', NEW.id,
      'ticket_row_id', NEW.ticket_id,
      'user_id', NEW.user_id,
      'comment', NEW.comment,
      'created_at', to_char((NEW.created_at AT TIME ZONE 'Asia/Manila'), 'YYYY-MM-DD"T"HH24:MI:SS.MS') || '+08:00'
    );
    -- Persist a notification for the ticket owner (but not for the commenter themself)
    INSERT INTO public.notifications (user_id, category, type, title, message, payload)
    SELECT t.user_id,
           'ticket'::text,
           'info'::text,
           'New comment on your ticket'::text,
           'IT replied to your ticket'::text,
           json_build_object(
             'ticket_id', t.ticket_id,
             'ticket_row_id', t.id,
             'comment_id', NEW.id,
             'action_url', concat('/forms/', t.ticket_id)
           )
    FROM tickets t
    WHERE t.id = NEW.ticket_id
      AND t.user_id <> NEW.user_id;
  ELSIF TG_OP = 'UPDATE' THEN
    payload := json_build_object(
      'event', 'update',
      'comment_id', NEW.id,
      'ticket_row_id', NEW.ticket_id,
      'user_id', NEW.user_id,
      'comment', NEW.comment,
      'updated_at', to_char((NEW.updated_at AT TIME ZONE 'Asia/Manila'), 'YYYY-MM-DD"T"HH24:MI:SS.MS') || '+08:00'
    );
  ELSIF TG_OP = 'DELETE' THEN
    payload := json_build_object(
      'event', 'delete',
      'comment_id', OLD.id,
      'ticket_row_id', OLD.ticket_id,
      'user_id', OLD.user_id
    );
  END IF;

  PERFORM pg_notify('ticket_comments', payload::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS ticket_comments_notify_insert ON public.ticket_comments;
DROP TRIGGER IF EXISTS ticket_comments_notify_update ON public.ticket_comments;
DROP TRIGGER IF EXISTS ticket_comments_notify_delete ON public.ticket_comments;

-- Create triggers for insert/update/delete
CREATE TRIGGER ticket_comments_notify_insert
AFTER INSERT ON public.ticket_comments
FOR EACH ROW EXECUTE FUNCTION notify_ticket_comment_change();

CREATE TRIGGER ticket_comments_notify_update
AFTER UPDATE ON public.ticket_comments
FOR EACH ROW EXECUTE FUNCTION notify_ticket_comment_change();

CREATE TRIGGER ticket_comments_notify_delete
AFTER DELETE ON public.ticket_comments
FOR EACH ROW EXECUTE FUNCTION notify_ticket_comment_change();


