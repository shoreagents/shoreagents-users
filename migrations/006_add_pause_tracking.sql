-- Add Emergency Pause Tracking to Break Sessions
-- This migration adds columns for tracking pause/resume functionality

-- Add pause tracking columns to break_sessions table
ALTER TABLE public.break_sessions 
ADD COLUMN IF NOT EXISTS pause_time timestamp NULL,
ADD COLUMN IF NOT EXISTS resume_time timestamp NULL, 
ADD COLUMN IF NOT EXISTS pause_used boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS time_remaining_at_pause int4 NULL; -- seconds remaining when paused

-- Add constraint to ensure pause_time is before resume_time
ALTER TABLE public.break_sessions 
ADD CONSTRAINT IF NOT EXISTS chk_pause_resume_order 
CHECK (pause_time IS NULL OR resume_time IS NULL OR pause_time < resume_time);

-- Add index for pause queries
CREATE INDEX IF NOT EXISTS idx_break_sessions_pause_used ON public.break_sessions(agent_user_id, pause_used);

-- Update the duration calculation function to handle pauses
CREATE OR REPLACE FUNCTION public.calculate_break_duration()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- If end_time is being set and start_time exists, calculate duration
    IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
        -- If break was paused, subtract pause duration from total
        IF NEW.pause_time IS NOT NULL AND NEW.resume_time IS NOT NULL THEN
            -- Total duration = (pause_time - start_time) + (end_time - resume_time)
            NEW.duration_minutes = EXTRACT(EPOCH FROM (
                (NEW.pause_time - NEW.start_time) + 
                (NEW.end_time - NEW.resume_time)
            )) / 60;
        ELSE
            -- Normal calculation for non-paused breaks
            NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$; 