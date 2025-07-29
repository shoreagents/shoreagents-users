-- Fix created_at Column Timezone for Break Sessions
-- This migration updates the default value for created_at to use Philippines timezone

-- Update the default value for created_at column to use Philippines timezone
ALTER TABLE public.break_sessions 
ALTER COLUMN created_at SET DEFAULT (NOW() AT TIME ZONE 'Asia/Manila');

-- Update any existing records with UTC created_at to convert them to Philippines timezone
-- Note: This assumes existing UTC times should be converted to display as Philippines time
-- UPDATE public.break_sessions 
-- SET created_at = created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'
-- WHERE created_at IS NOT NULL;

-- Add a comment explaining the change
COMMENT ON COLUMN public.break_sessions.created_at IS 'Record creation timestamp in Philippines timezone (Asia/Manila)'; 