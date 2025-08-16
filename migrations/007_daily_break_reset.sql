-- Migration: Add daily break tracking and reset functionality
-- Date: 2025-01-23

-- Add column to track the last date breaks were reset for each agent
ALTER TABLE public.break_sessions 
ADD COLUMN break_date DATE DEFAULT CURRENT_DATE;

-- Create index for better performance on date queries
CREATE INDEX idx_break_sessions_agent_date ON public.break_sessions(agent_user_id, break_date);
CREATE INDEX idx_break_sessions_break_date ON public.break_sessions(break_date);

-- Create a function to reset daily breaks for all agents
CREATE OR REPLACE FUNCTION reset_daily_breaks()
RETURNS INTEGER AS $$
DECLARE
    reset_count INTEGER := 0;
BEGIN
    -- This function doesn't delete data, it just ensures that break usage
    -- is calculated based on today's date only
    
    -- Count how many agents would be affected (for logging purposes)
    SELECT COUNT(DISTINCT agent_user_id) 
    INTO reset_count
    FROM public.break_sessions 
    WHERE break_date = CURRENT_DATE;
    
    -- The reset is implicit - break availability is checked by querying
    -- only today's break_sessions records
    
    RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to check if an agent can take a specific break type today
CREATE OR REPLACE FUNCTION can_agent_take_break(
    p_agent_user_id INTEGER,
    p_break_type break_type_enum
)
RETURNS BOOLEAN AS $$
DECLARE
    break_count INTEGER;
BEGIN
    -- Check if agent has already used this break type today
    SELECT COUNT(*)
    INTO break_count
    FROM public.break_sessions
    WHERE agent_user_id = p_agent_user_id
    AND break_type = p_break_type
    AND break_date = CURRENT_DATE
    AND end_time IS NOT NULL; -- Only count completed breaks
    
    -- Each break type can only be used once per day
    RETURN break_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Create a function to get agent's break summary for today
CREATE OR REPLACE FUNCTION get_agent_daily_breaks(p_agent_user_id INTEGER)
RETURNS TABLE(
    break_type break_type_enum,
    break_count INTEGER,
    total_minutes INTEGER,
    can_take_break BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH break_types AS (
        SELECT unnest(enum_range(NULL::break_type_enum)) AS bt
    ),
    today_breaks AS (
        SELECT 
            bs.break_type,
            COUNT(*) as break_count,
            COALESCE(SUM(bs.duration_minutes), 0) as total_minutes
        FROM public.break_sessions bs
        WHERE bs.agent_user_id = p_agent_user_id
        AND bs.break_date = CURRENT_DATE
        AND bs.end_time IS NOT NULL
        GROUP BY bs.break_type
    )
    SELECT 
        bt.bt as break_type,
        COALESCE(tb.break_count, 0)::INTEGER as break_count,
        COALESCE(tb.total_minutes, 0)::INTEGER as total_minutes,
        (COALESCE(tb.break_count, 0) = 0) as can_take_break
    FROM break_types bt
    LEFT JOIN today_breaks tb ON bt.bt = tb.break_type
    ORDER BY bt.bt;
END;
$$ LANGUAGE plpgsql;

-- Update existing records to have today's date (for migration)
UPDATE public.break_sessions 
SET break_date = start_time::DATE 
WHERE break_date IS NULL;

-- Make break_date NOT NULL after setting existing values
ALTER TABLE public.break_sessions 
ALTER COLUMN break_date SET NOT NULL; 