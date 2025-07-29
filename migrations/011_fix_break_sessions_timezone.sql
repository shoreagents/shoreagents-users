-- Fix Break Sessions Table Timezone Defaults
-- This migration updates the existing break_sessions table to use simplified Philippines timezone

-- Fix the break_sessions table defaults to use simplified Philippines timezone syntax
ALTER TABLE public.break_sessions 
ALTER COLUMN start_time SET DEFAULT (NOW() AT TIME ZONE 'Asia/Manila'),
ALTER COLUMN created_at SET DEFAULT (NOW() AT TIME ZONE 'Asia/Manila'),
ALTER COLUMN break_date SET DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')::date;

-- Update any NULL break_date records to use the current Philippines date
UPDATE public.break_sessions 
SET break_date = (NOW() AT TIME ZONE 'Asia/Manila')::date 
WHERE break_date IS NULL;

-- Ensure break_date cannot be NULL going forward
ALTER TABLE public.break_sessions 
ALTER COLUMN break_date SET NOT NULL;

-- Add index on break_date for better performance on daily break queries
CREATE INDEX IF NOT EXISTS idx_break_sessions_break_date ON public.break_sessions(break_date);

-- Add index on agent_user_id and break_date combination for daily break lookups
CREATE INDEX IF NOT EXISTS idx_break_sessions_agent_date ON public.break_sessions(agent_user_id, break_date);

-- Update comments to reflect the timezone handling
COMMENT ON COLUMN public.break_sessions.start_time IS 'Break start time in Philippines timezone (Asia/Manila)';
COMMENT ON COLUMN public.break_sessions.end_time IS 'Break end time in Philippines timezone (Asia/Manila)';
COMMENT ON COLUMN public.break_sessions.pause_time IS 'Break pause time in Philippines timezone (Asia/Manila)';
COMMENT ON COLUMN public.break_sessions.resume_time IS 'Break resume time in Philippines timezone (Asia/Manila)';
COMMENT ON COLUMN public.break_sessions.created_at IS 'Record creation time in Philippines timezone (Asia/Manila)';
COMMENT ON COLUMN public.break_sessions.break_date IS 'Break date in Philippines timezone (Asia/Manila) - used for daily break limits'; 