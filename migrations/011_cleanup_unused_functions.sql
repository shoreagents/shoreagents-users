-- Cleanup: Drop unused functions
-- This migration removes functions that are no longer needed

-- Drop the unused reset_daily_breaks function
-- The break reset is now completely automatic based on date comparison
DROP FUNCTION IF EXISTS public.reset_daily_breaks(text);

-- Also drop the parameter-less version if it exists
DROP FUNCTION IF EXISTS public.reset_daily_breaks();

-- Add a comment explaining the automatic reset
COMMENT ON FUNCTION public.can_agent_take_break(integer, break_type_enum) IS 
'Automatically resets daily break limits by only counting breaks from current Philippines date. No manual reset needed.';

COMMENT ON FUNCTION public.get_agent_daily_breaks(integer) IS 
'Automatically provides fresh daily break counts by only querying current Philippines date. Reset is implicit and automatic.'; 