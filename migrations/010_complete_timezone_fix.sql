-- Complete Timezone Fix for Break Sessions
-- This migration fixes all remaining timezone issues in the break_sessions table

-- Fix the break_sessions table to use Philippines timezone (matching other tables)
ALTER TABLE public.break_sessions 
ALTER COLUMN start_time SET DEFAULT (NOW() AT TIME ZONE 'Asia/Manila'),
ALTER COLUMN created_at SET DEFAULT (NOW() AT TIME ZONE 'Asia/Manila'),
ALTER COLUMN break_date SET DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')::date;

-- Also update the pause and resume time defaults if they don't already have defaults
ALTER TABLE public.break_sessions 
ALTER COLUMN pause_time SET DEFAULT NULL,
ALTER COLUMN resume_time SET DEFAULT NULL;

-- Update the update_updated_at_column function to use Philippines timezone
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW() AT TIME ZONE 'Asia/Manila';
    RETURN NEW;
END;
$function$;

-- Create a function to check if daily reset is needed for an agent
CREATE OR REPLACE FUNCTION public.should_reset_agent_breaks(p_agent_user_id integer)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    last_reset_date DATE;
    current_local_date DATE;
BEGIN
    -- Get current date in Philippines timezone
    current_local_date := (NOW() AT TIME ZONE 'Asia/Manila')::date;
    
    -- Get the latest break_date for this agent
    SELECT MAX(break_date) INTO last_reset_date
    FROM break_sessions
    WHERE agent_user_id = p_agent_user_id;
    
    -- If no breaks exist or last break was before today, reset is needed
    RETURN (last_reset_date IS NULL OR last_reset_date < current_local_date);
END;
$function$;

-- Create a function to get Philippines local time for break operations
CREATE OR REPLACE FUNCTION public.get_philippines_now()
RETURNS timestamptz
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN NOW() AT TIME ZONE 'Asia/Manila';
END;
$function$;

-- Add comments explaining the timezone handling
COMMENT ON COLUMN public.break_sessions.start_time IS 'Break start time in Philippines timezone (Asia/Manila)';
COMMENT ON COLUMN public.break_sessions.end_time IS 'Break end time in Philippines timezone (Asia/Manila)';
COMMENT ON COLUMN public.break_sessions.pause_time IS 'Break pause time in Philippines timezone (Asia/Manila)';
COMMENT ON COLUMN public.break_sessions.resume_time IS 'Break resume time in Philippines timezone (Asia/Manila)';
COMMENT ON COLUMN public.break_sessions.created_at IS 'Record creation time in Philippines timezone (Asia/Manila)';
COMMENT ON COLUMN public.break_sessions.break_date IS 'Break date in Philippines timezone (Asia/Manila)';

COMMENT ON FUNCTION public.get_philippines_now() IS 'Returns current timestamp in Philippines timezone (Asia/Manila)';
COMMENT ON FUNCTION public.should_reset_agent_breaks(integer) IS 'Checks if agent breaks should be reset for the current day';
COMMENT ON FUNCTION public.can_agent_take_break(integer, break_type_enum) IS 'Checks if agent can take a break type using Philippines timezone for date comparison';
COMMENT ON FUNCTION public.get_agent_daily_breaks(integer) IS 'Returns daily break summary using Philippines timezone for date calculations'; 