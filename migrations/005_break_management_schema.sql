-- Break Management Schema - Updated to match comprehensive DDL
-- This migration creates the break management tables

-- Create ENUM type for break types (capitalized as per DDL)
CREATE TYPE IF NOT EXISTS public.break_type_enum AS ENUM (
	'Morning',
	'Lunch',
	'Afternoon'
);

-- Create break_sessions table (referencing agents table as per DDL)
CREATE TABLE IF NOT EXISTS public.break_sessions (
	id serial4 NOT NULL,
	agent_user_id int4 NOT NULL, -- Agent taking the break (references agents.user_id)
	break_type public.break_type_enum NOT NULL,
	start_time timestamp NOT NULL,
	end_time timestamp NULL, -- NULL if break is still active
	duration_minutes int4 NULL, -- Calculated duration when break ends
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT break_sessions_pkey PRIMARY KEY (id),
	CONSTRAINT break_sessions_agent_user_id_fkey FOREIGN KEY (agent_user_id) REFERENCES public.agents(user_id) ON DELETE CASCADE
);

-- Add trigger for auto-calculating duration when break ends
CREATE OR REPLACE FUNCTION public.calculate_break_duration()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- If end_time is being set and start_time exists, calculate duration
    IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
        NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS calculate_break_duration_trigger ON public.break_sessions;
CREATE TRIGGER calculate_break_duration_trigger
    BEFORE INSERT OR UPDATE ON public.break_sessions
    FOR EACH ROW
    EXECUTE FUNCTION calculate_break_duration();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_break_sessions_agent_user_id ON public.break_sessions(agent_user_id);
CREATE INDEX IF NOT EXISTS idx_break_sessions_break_type ON public.break_sessions(break_type);
CREATE INDEX IF NOT EXISTS idx_break_sessions_start_time ON public.break_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_break_sessions_date ON public.break_sessions(DATE(start_time));
CREATE INDEX IF NOT EXISTS idx_break_sessions_active ON public.break_sessions(agent_user_id, end_time) WHERE end_time IS NULL; 