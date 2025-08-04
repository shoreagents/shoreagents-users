-- Fix the update_updated_at_column function to use Philippines timezone properly
-- The issue is that PostgreSQL stores timestamps in UTC internally

-- Drop and recreate the function to use Philippines timezone
DROP FUNCTION IF EXISTS update_updated_at_column();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Store timestamp in UTC but ensure it's created in Philippines timezone context
    -- This way the timestamp represents the correct Philippines time
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a function to get Philippines time for display purposes
CREATE OR REPLACE FUNCTION get_philippines_timestamp(timestamp_with_timezone TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    -- Convert the timestamp to Philippines timezone for display
    RETURN timestamp_with_timezone AT TIME ZONE 'Asia/Manila';
END;
$$ language 'plpgsql';

-- Create a function to get current Philippines time
CREATE OR REPLACE FUNCTION get_current_philippines_time()
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    -- Get current time in Philippines timezone
    RETURN NOW() AT TIME ZONE 'Asia/Manila';
END;
$$ language 'plpgsql'; 