-- Add storage path column to task_attachments for safe deletions
ALTER TABLE public.task_attachments
  ADD COLUMN IF NOT EXISTS path TEXT;

-- Backfill could be added here if needed by deriving from URL


