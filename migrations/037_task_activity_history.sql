-- Task activity history schema

-- Enum for activity actions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'task_activity_action'
  ) THEN
    CREATE TYPE task_activity_action AS ENUM (
      'task_created',
      'task_updated',
      'attachments_added',
      'attachment_deleted'
    );
  END IF;
END $$;

-- Table to store events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='task_activity_events'
  ) THEN
    CREATE TABLE public.task_activity_events (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
      actor_user_id INTEGER NULL REFERENCES public.users(id) ON DELETE SET NULL,
      action task_activity_action NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_activity_events_task_id ON public.task_activity_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_activity_events_created_at ON public.task_activity_events(created_at DESC);
  END IF;
END $$;


