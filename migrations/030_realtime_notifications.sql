-- Notifications schema and triggers for realtime socket broadcasting
-- Creates a generic notifications table and trigger that emits pg_notify

-- Table: public.notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id serial4 PRIMARY KEY,
  user_id int4 NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category text NOT NULL, -- e.g., 'ticket' | 'break' | 'system'
  type text NOT NULL,     -- e.g., 'info' | 'success' | 'warning' | 'error'
  title text NOT NULL,
  message text NOT NULL,
  payload jsonb,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- Function: public.notify_notification()
CREATE OR REPLACE FUNCTION public.notify_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify(
    'notifications',
    json_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'category', NEW.category,
      'type', NEW.type,
      'title', NEW.title,
      'message', NEW.message,
      'payload', COALESCE(NEW.payload, '{}'::jsonb),
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$;

-- Trigger on notifications table to emit LISTEN/NOTIFY
DROP TRIGGER IF EXISTS trg_notify_notification ON public.notifications;
CREATE TRIGGER trg_notify_notification
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.notify_notification();

-- Ticket status change -> create notification
CREATE OR REPLACE FUNCTION public.create_ticket_status_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  title_text text;
  message_text text;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    title_text := 'Ticket status updated';
    message_text := format('Ticket %s is now %s', NEW.ticket_id, NEW.status);
    INSERT INTO public.notifications (user_id, category, type, title, message, payload)
    VALUES (
      NEW.user_id,
      'ticket',
      CASE WHEN NEW.status = 'Closed' THEN 'success' ELSE 'info' END,
      title_text,
      message_text,
      json_build_object('ticket_id', NEW.ticket_id, 'status', NEW.status, 'ticket_row_id', NEW.id, 'action_url', concat('/forms/', NEW.ticket_id))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_status_notification ON public.tickets;
CREATE TRIGGER trg_ticket_status_notification
AFTER UPDATE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.create_ticket_status_notification();

-- Break session lifecycle notifications
CREATE OR REPLACE FUNCTION public.create_break_status_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  title_text text;
  message_text text;
  notif_type text := 'info';
BEGIN
  IF TG_OP = 'INSERT' THEN
    title_text := 'Break started';
    message_text := format('%s break started', NEW.break_type);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.end_time IS NOT NULL AND (OLD.end_time IS NULL OR NEW.end_time <> OLD.end_time) THEN
      title_text := 'Break ended';
      message_text := format('%s break completed (%s min)', NEW.break_type, COALESCE(NEW.duration_minutes, 0));
      notif_type := 'success';
    ELSIF NEW.pause_time IS NOT NULL AND (OLD.pause_time IS DISTINCT FROM NEW.pause_time) THEN
      title_text := 'Break paused';
      message_text := format('%s break paused', NEW.break_type);
      notif_type := 'warning';
    ELSIF NEW.resume_time IS NOT NULL AND (OLD.resume_time IS DISTINCT FROM NEW.resume_time) THEN
      title_text := 'Break resumed';
      message_text := format('%s break resumed', NEW.break_type);
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, category, type, title, message, payload)
  VALUES (
    NEW.agent_user_id,
    'break',
    notif_type,
    title_text,
    message_text,
    json_build_object('break_type', NEW.break_type, 'break_session_id', NEW.id, 'break_date', NEW.break_date, 'action_url', '/status/breaks')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_break_status_insert_notification ON public.break_sessions;
CREATE TRIGGER trg_break_status_insert_notification
AFTER INSERT ON public.break_sessions
FOR EACH ROW EXECUTE FUNCTION public.create_break_status_notification();

DROP TRIGGER IF EXISTS trg_break_status_update_notification ON public.break_sessions;
CREATE TRIGGER trg_break_status_update_notification
AFTER UPDATE ON public.break_sessions
FOR EACH ROW EXECUTE FUNCTION public.create_break_status_notification();


-- Task due date proximity notifications
-- Notifies the owner when a task is created/updated whose due_date is within the next 24 hours
CREATE OR REPLACE FUNCTION public.notify_task_due_soon()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  due_ts timestamptz;
  now_ts timestamptz := now() AT TIME ZONE 'Asia/Manila';
  hours_diff numeric;
  title_text text;
  message_text text;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    due_ts := NEW.due_date;
    IF due_ts IS NULL THEN
      RETURN NEW;
    END IF;
    -- Compute hours until due
    hours_diff := EXTRACT(EPOCH FROM (due_ts - now_ts)) / 3600.0;
    -- If due within next 24h and still active, create a warning notification
    IF hours_diff <= 24 AND hours_diff >= 0 AND NEW.status = 'active' THEN
      title_text := 'Task due soon';
      message_text := format('"%s" is due on %s', NEW.title, to_char(due_ts AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY HH24:MI'));
      INSERT INTO public.notifications (user_id, category, type, title, message, payload)
      VALUES (
        NEW.user_id,
        'task',
        'warning',
        title_text,
        message_text,
        json_build_object('task_id', NEW.id, 'group_id', NEW.group_id, 'due_date', NEW.due_date, 'action_url', '/productivity/task-activity')
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_due_soon ON public.tasks;
CREATE TRIGGER trg_task_due_soon
AFTER INSERT OR UPDATE OF due_date, status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_due_soon();


