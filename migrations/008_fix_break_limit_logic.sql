-- Fix Break Limit Logic
-- This migration fixes the issue where agents can take the same break type multiple times per day

-- Update the can_agent_take_break function to properly count all breaks (active + completed)
CREATE OR REPLACE FUNCTION public.can_agent_take_break(
    p_agent_user_id INTEGER,
    p_break_type break_type_enum
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $function$
DECLARE
    break_count INTEGER;
BEGIN
    -- Count ALL breaks of this type for today (both active and completed)
    -- This prevents starting a break if one was already taken today
    SELECT COUNT(*) INTO break_count
    FROM break_sessions
    WHERE agent_user_id = p_agent_user_id
    AND break_type = p_break_type
    AND break_date = (NOW() AT TIME ZONE 'Asia/Manila')::date;
    
    -- Each break type can only be taken once per day
    RETURN break_count = 0;
END;
$function$;

-- Also update get_agent_daily_breaks to be consistent
CREATE OR REPLACE FUNCTION public.get_agent_daily_breaks(p_agent_user_id integer)
RETURNS TABLE(
    break_type break_type_enum,
    break_count bigint,
    can_take_break boolean,
    last_break_time timestamp
)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH break_types AS (
        SELECT unnest(enum_range(NULL::break_type_enum)) as bt
    ),
    break_counts AS (
        SELECT 
            bt.bt as break_type,
            COALESCE(bs.break_count, 0) as break_count,
            bs.last_break_time
        FROM break_types bt
        LEFT JOIN (
            SELECT 
                bs.break_type,
                COUNT(*) as break_count,
                MAX(bs.start_time) as last_break_time
            FROM break_sessions bs
            WHERE bs.agent_user_id = p_agent_user_id 
            AND bs.break_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
            GROUP BY bs.break_type
        ) bs ON bt.bt = bs.break_type
    )
    SELECT 
        bc.break_type,
        bc.break_count,
        (bc.break_count = 0) as can_take_break,
        bc.last_break_time
    FROM break_counts bc
    ORDER BY bc.break_type;
END;
$function$;

-- Add a comment explaining the fix
COMMENT ON FUNCTION public.can_agent_take_break IS 'Checks if agent can take a break type. Returns false if any break of this type exists for today (active or completed).';
COMMENT ON FUNCTION public.get_agent_daily_breaks IS 'Returns daily break summary including availability. Each break type can only be taken once per day.'; 