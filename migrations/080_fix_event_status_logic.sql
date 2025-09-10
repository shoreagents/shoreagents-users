-- Fix event status logic to properly handle date and time transitions
-- This migration updates the event status trigger to properly handle:
-- 1. Moving events from 'upcoming' to 'today' when event_date is today (regardless of start_time)
-- 2. Moving events from 'today' to 'ended' when they pass their end_time on the same day
-- 3. Moving events from 'upcoming' to 'ended' when event_date is in the past

-- Update the event status trigger function to handle all status transitions properly
CREATE OR REPLACE FUNCTION update_event_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update events to 'today' if event_date is today (Philippines time) - regardless of start_time
    UPDATE events 
    SET status = 'today', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE event_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
    AND status = 'upcoming';
    
    -- Update events to 'ended' if event_date is in the past and status is not 'cancelled' (Philippines time)
    UPDATE events 
    SET status = 'ended', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE event_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
    AND status IN ('upcoming', 'today');
    
    -- Update events to 'ended' if they are 'today' but have passed their end_time (Philippines time)
    UPDATE events 
    SET status = 'ended', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE event_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
    AND status = 'today'
    AND end_time::TIME < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::TIME;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a function to manually update event statuses (for use in scheduled jobs)
CREATE OR REPLACE FUNCTION update_all_event_statuses()
RETURNS TABLE (
    updated_count INTEGER,
    details TEXT
) AS $$
DECLARE
    upcoming_to_today_count INTEGER := 0;
    today_to_ended_count INTEGER := 0;
    past_to_ended_count INTEGER := 0;
    total_updated INTEGER := 0;
BEGIN
    -- Update events to 'today' if event_date is today (regardless of start_time)
    UPDATE events 
    SET status = 'today', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE event_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
    AND status = 'upcoming';
    
    GET DIAGNOSTICS upcoming_to_today_count = ROW_COUNT;
    
    -- Update events to 'ended' if event_date is in the past
    UPDATE events 
    SET status = 'ended', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE event_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
    AND status IN ('upcoming', 'today');
    
    GET DIAGNOSTICS past_to_ended_count = ROW_COUNT;
    
    -- Update events to 'ended' if they are 'today' but have passed their end_time
    UPDATE events 
    SET status = 'ended', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE event_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
    AND status = 'today'
    AND end_time::TIME < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::TIME;
    
    GET DIAGNOSTICS today_to_ended_count = ROW_COUNT;
    
    total_updated := upcoming_to_today_count + today_to_ended_count + past_to_ended_count;
    
    RETURN QUERY SELECT 
        total_updated,
        format('Updated: %s upcoming→today, %s today→ended (time), %s past→ended', 
               upcoming_to_today_count, today_to_ended_count, past_to_ended_count);
END;
$$ LANGUAGE plpgsql;
