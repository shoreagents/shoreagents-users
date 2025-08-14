-- Create task_attachments table to store files per task
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'task_attachments'
  ) THEN
    CREATE TABLE public.task_attachments (
      id SERIAL PRIMARY KEY,
      task_id INTEGER NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
      name TEXT,
      url TEXT NOT NULL,
      type TEXT,
      size BIGINT,
      position INTEGER DEFAULT 0,
      created_at timestamptz DEFAULT now() NULL,
      updated_at timestamptz DEFAULT now() NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);
  END IF;
END $$;

-- Update updated_at on row change
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_task_attachments_updated_at'
  ) THEN
    CREATE TRIGGER update_task_attachments_updated_at
    BEFORE UPDATE ON public.task_attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;


