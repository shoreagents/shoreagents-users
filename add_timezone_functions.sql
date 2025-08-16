-- Add timezone functions for Philippines timezone
-- Run this manually in your database

-- Function to calculate time difference safely for Philippines timezone
CREATE OR REPLACE FUNCTION calculate_time_diff(
    last_update TIMESTAMP WITH TIME ZONE,
    current_time TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    time_diff INTEGER;
    philippines_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Use provided time or get current Philippines time
    IF current_time IS NULL THEN
        philippines_time := NOW() AT TIME ZONE 'Asia/Manila';
    ELSE
        philippines_time := current_time AT TIME ZONE 'Asia/Manila';
    END IF;
    
    -- Calculate difference in seconds
    time_diff := EXTRACT(EPOCH FROM (philippines_time - last_update));
    
    -- Return absolute value to handle timezone issues
    RETURN GREATEST(0, time_diff);
END;
$$ language 'plpgsql';

-- Function to get current time in Philippines timezone (GMT+8)
CREATE OR REPLACE FUNCTION get_philippines_now()
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    -- Return Philippines time (GMT+8)
    RETURN NOW() AT TIME ZONE 'Asia/Manila';
END;
$$ language 'plpgsql'; 