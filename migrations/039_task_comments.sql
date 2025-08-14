-- Task comments schema and realtime trigger

-- Enable pgcrypto for gen_random_uuid if not enabled
DO $$ BEGIN
  PERFORM 1 FROM pg_extension WHERE extname = 'pgcrypto';
  IF NOT FOUND THEN
    CREATE EXTENSION pgcrypto;
  END IF;
END $$;

-- Create table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id INTEGER NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON public.task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created_at ON public.task_comments(created_at);

-- Updated_at trigger function (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_task_comments_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.update_task_comments_updated_at()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at := NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Attach updated_at trigger if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_task_comments_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_task_comments_set_updated_at
    BEFORE UPDATE ON public.task_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_task_comments_updated_at();
  END IF;
END $$;

-- Realtime NOTIFY trigger function (create/replace)
CREATE OR REPLACE FUNCTION public.notify_task_comment_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor_name TEXT;
  actor_email TEXT;
  payload JSON;
BEGIN
  -- Fetch author info
  SELECT COALESCE(pi.first_name || ' ' || pi.last_name, u.email), u.email
  INTO actor_name, actor_email
  FROM public.users u
  LEFT JOIN public.personal_info pi ON pi.user_id = u.id
  WHERE u.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;

  payload := json_build_object(
    'event', lower(TG_OP),
    'comment_id', (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END),
    'task_id', (CASE WHEN TG_OP = 'DELETE' THEN OLD.task_id ELSE NEW.task_id END),
    'user_id', (CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END),
    'comment', (CASE WHEN TG_OP = 'DELETE' THEN OLD.content ELSE NEW.content END),
    'authorName', actor_name,
    'authorEmail', actor_email,
    'created_at', (CASE WHEN TG_OP = 'DELETE' THEN OLD.created_at ELSE NEW.created_at END),
    'updated_at', (CASE WHEN TG_OP = 'DELETE' THEN OLD.updated_at ELSE NEW.updated_at END),
    'time', (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
  );

  PERFORM pg_notify('task_comments', payload::text);
  RETURN NULL;
END;
$$;

-- Attach trigger to table if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'notify_task_comment_change'
  ) THEN
    CREATE TRIGGER notify_task_comment_change
    AFTER INSERT OR UPDATE OR DELETE ON public.task_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_task_comment_change();
  END IF;
END $$;


