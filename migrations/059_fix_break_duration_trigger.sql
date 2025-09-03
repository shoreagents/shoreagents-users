-- Migration 059: Fix missing break duration calculation trigger
-- The calculate_break_duration function exists but the trigger is missing
-- This migration creates the missing trigger to automatically calculate duration_minutes

-- Ensure the function exists (it should already exist from migration 027)
CREATE OR REPLACE FUNCTION public.calculate_break_duration()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- If end_time is being set and start_time exists, calculate duration
    IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
        -- If break was paused, calculate based on pause state
        IF NEW.pause_time IS NOT NULL THEN
            -- If break was resumed, use normal pause calculation
            IF NEW.resume_time IS NOT NULL THEN
                -- Total duration = (pause_time - start_time) + (end_time - resume_time)
                NEW.duration_minutes = EXTRACT(EPOCH FROM (
                    (NEW.pause_time - NEW.start_time) + 
                    (NEW.end_time - NEW.resume_time)
                )) / 60;
            ELSE
                -- Break was paused but never resumed (auto-ended)
                -- Use the time from start to pause as the actual break duration
                NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.pause_time - NEW.start_time)) / 60;
            END IF;
        ELSE
            -- Normal calculation for non-paused breaks
            NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

-- Drop the trigger if it exists (in case it was partially created)
DROP TRIGGER IF EXISTS calculate_break_duration_trigger ON public.break_sessions;

-- Create the trigger to automatically calculate duration when break ends
CREATE TRIGGER calculate_break_duration_trigger
    BEFORE INSERT OR UPDATE ON public.break_sessions
    FOR EACH ROW
    EXECUTE FUNCTION calculate_break_duration();

-- Add comment to explain the trigger
COMMENT ON TRIGGER calculate_break_duration_trigger ON public.break_sessions IS 
'Automatically calculates duration_minutes when end_time is set, handling paused breaks correctly';

-- Update existing break sessions that have end_time but no duration_minutes
UPDATE public.break_sessions 
SET duration_minutes = EXTRACT(EPOCH FROM (end_time - start_time)) / 60
WHERE end_time IS NOT NULL 
AND duration_minutes IS NULL
AND pause_time IS NULL;

-- Update existing paused break sessions that have end_time but no duration_minutes
UPDATE public.break_sessions 
SET duration_minutes = CASE 
    WHEN resume_time IS NOT NULL THEN
        EXTRACT(EPOCH FROM (
            (pause_time - start_time) + 
            (end_time - resume_time)
        )) / 60
    ELSE
        EXTRACT(EPOCH FROM (pause_time - start_time)) / 60
END
WHERE end_time IS NOT NULL 
AND duration_minutes IS NULL
AND pause_time IS NOT NULL;
