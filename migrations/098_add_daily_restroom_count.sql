-- Add daily restroom count tracking
-- Migration: 098_add_daily_restroom_count.sql
-- Description: Adds daily_restroom_count field to track daily visits while preserving total count

-- Add daily_restroom_count column
ALTER TABLE public.agent_restroom_status 
ADD COLUMN IF NOT EXISTS daily_restroom_count INTEGER NOT NULL DEFAULT 0;

-- Add last_daily_reset column to track when the daily count was last reset
ALTER TABLE public.agent_restroom_status 
ADD COLUMN IF NOT EXISTS last_daily_reset DATE DEFAULT CURRENT_DATE;

-- Update existing records to set last_daily_reset to today
UPDATE public.agent_restroom_status 
SET last_daily_reset = CURRENT_DATE 
WHERE last_daily_reset IS NULL;

-- Create index for better performance on daily reset queries
CREATE INDEX IF NOT EXISTS idx_agent_restroom_status_last_daily_reset 
ON public.agent_restroom_status(last_daily_reset);

-- Add comment to clarify the difference between the two count fields
COMMENT ON COLUMN public.agent_restroom_status.restroom_count IS 'Total cumulative restroom visits since account creation';
COMMENT ON COLUMN public.agent_restroom_status.daily_restroom_count IS 'Restroom visits for the current day (resets daily)';
COMMENT ON COLUMN public.agent_restroom_status.last_daily_reset IS 'Date when daily_restroom_count was last reset';

























