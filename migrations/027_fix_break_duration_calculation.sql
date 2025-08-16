-- Fix Break Duration Calculation for Auto-Ended Paused Breaks
-- This migration fixes the duration calculation when breaks are auto-ended while paused

-- Update the duration calculation function to handle auto-ended paused breaks
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

-- Add comment to explain the function
COMMENT ON FUNCTION public.calculate_break_duration() IS 
'Calculates break duration in minutes. For paused breaks that are auto-ended, uses time from start to pause as the actual break duration.'; 