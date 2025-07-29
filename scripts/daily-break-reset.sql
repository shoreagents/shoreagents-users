-- Daily Break Reset Script
-- Run this script daily at midnight (e.g., via cron job)
-- Usage: psql -d your_database -f daily-break-reset.sql

-- Log the reset operation
DO $$
DECLARE
    agent_count INTEGER;
    today_date DATE := CURRENT_DATE;
BEGIN
    -- Count total agents in system
    SELECT COUNT(*) INTO agent_count FROM public.agents;
    
    -- Log the reset operation
    RAISE NOTICE 'Daily break reset executed on % for % agents', today_date, agent_count;
    
    -- The actual "reset" happens automatically because:
    -- 1. Break availability is checked using break_date = CURRENT_DATE
    -- 2. Each new day, agents can take breaks again since no records exist for the new date
    -- 3. Historical data is preserved for reporting
    
    RAISE NOTICE 'Break reset completed. All agents can now take their daily breaks.';
END $$;

-- Optional: Clean up very old break session data (older than 1 year)
-- Uncomment the lines below if you want to archive old data
/*
DELETE FROM public.break_sessions 
WHERE break_date < CURRENT_DATE - INTERVAL '1 year';

RAISE NOTICE 'Cleaned up break sessions older than 1 year';
*/

-- Optional: Get summary of yesterday's break usage
DO $$
DECLARE
    yesterday_date DATE := CURRENT_DATE - 1;
    rec RECORD;
BEGIN
    RAISE NOTICE 'Break summary for %:', yesterday_date;
    
    FOR rec IN 
        SELECT 
            break_type,
            COUNT(*) as total_breaks,
            COUNT(DISTINCT agent_user_id) as agents_used,
            AVG(duration_minutes) as avg_duration
        FROM public.break_sessions 
        WHERE break_date = yesterday_date 
        AND end_time IS NOT NULL
        GROUP BY break_type
        ORDER BY break_type
    LOOP
        RAISE NOTICE '  %: % breaks by % agents (avg: % min)', 
            rec.break_type, rec.total_breaks, rec.agents_used, ROUND(rec.avg_duration, 1);
    END LOOP;
END $$; 