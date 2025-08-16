-- Task realtime NOTIFY/LISTEN triggers
-- Creates a single reusable trigger function that broadcasts row changes
-- for: tasks, task_relations, task_groups, task_custom_fields, task_attachments, task_assignees

-- Safe drop to allow re-run
DO $$ BEGIN
  PERFORM 1 FROM pg_proc WHERE proname = 'notify_task_table_change';
  IF FOUND THEN
    -- do nothing; function will be replaced below
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.notify_task_table_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  payload JSON;
  channel TEXT;
BEGIN
  payload := json_build_object(
    'table', TG_TABLE_NAME,
    'action', TG_OP,
    'new', CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN row_to_json(NEW) ELSE NULL END,
    'old', CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN row_to_json(OLD) ELSE NULL END,
    'timestamp', now()
  );

  -- Map table -> channel
  IF TG_TABLE_NAME = 'tasks' THEN
    channel := 'task_updates';
  ELSIF TG_TABLE_NAME = 'task_relations' THEN
    channel := 'task_relations';
  ELSIF TG_TABLE_NAME = 'task_groups' THEN
    channel := 'task_groups';
  ELSIF TG_TABLE_NAME = 'task_custom_fields' THEN
    channel := 'task_custom_fields';
  ELSIF TG_TABLE_NAME = 'task_attachments' THEN
    channel := 'task_attachments';
  ELSIF TG_TABLE_NAME = 'task_assignees' THEN
    channel := 'task_assignees';
  ELSE
    channel := 'task_updates';
  END IF;

  PERFORM pg_notify(channel, payload::text);
  RETURN NULL;
END;
$$;

-- Helper to create an AFTER trigger if not exists
-- (Postgres lacks CREATE TRIGGER IF NOT EXISTS; use DO block)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'notify_tasks_change'
  ) THEN
    CREATE TRIGGER notify_tasks_change
    AFTER INSERT OR UPDATE OR DELETE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.notify_task_table_change();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'notify_task_relations_change'
  ) THEN
    CREATE TRIGGER notify_task_relations_change
    AFTER INSERT OR UPDATE OR DELETE ON public.task_relations
    FOR EACH ROW EXECUTE FUNCTION public.notify_task_table_change();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'notify_task_groups_change'
  ) THEN
    CREATE TRIGGER notify_task_groups_change
    AFTER INSERT OR UPDATE OR DELETE ON public.task_groups
    FOR EACH ROW EXECUTE FUNCTION public.notify_task_table_change();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'notify_task_custom_fields_change'
  ) THEN
    CREATE TRIGGER notify_task_custom_fields_change
    AFTER INSERT OR UPDATE OR DELETE ON public.task_custom_fields
    FOR EACH ROW EXECUTE FUNCTION public.notify_task_table_change();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'notify_task_attachments_change'
  ) THEN
    CREATE TRIGGER notify_task_attachments_change
    AFTER INSERT OR UPDATE OR DELETE ON public.task_attachments
    FOR EACH ROW EXECUTE FUNCTION public.notify_task_table_change();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'notify_task_assignees_change'
  ) THEN
    CREATE TRIGGER notify_task_assignees_change
    AFTER INSERT OR UPDATE OR DELETE ON public.task_assignees
    FOR EACH ROW EXECUTE FUNCTION public.notify_task_table_change();
  END IF;
END $$;


