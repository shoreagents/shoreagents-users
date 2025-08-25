-- Fix Productivity Trigger to Actually Calculate Scores
-- The current trigger only sends notifications but doesn't calculate productivity scores
-- This migration fixes it to actually perform the calculations

-- Drop the current trigger that only sends notifications
DROP TRIGGER IF EXISTS trg_productivity_score_on_time_change ON activity_data;

-- Drop the current function
DROP FUNCTION IF EXISTS update_productivity_score_on_time_change();

-- Create a new function that actually calculates productivity scores
CREATE OR REPLACE FUNCTION update_productivity_score_on_time_change()
RETURNS TRIGGER AS $$
DECLARE
    affected_month_year VARCHAR(7);
    time_changed BOOLEAN;
BEGIN
    -- Only proceed if this is an UPDATE operation with time tracking changes
    IF TG_OP = 'UPDATE' THEN
        -- Check if time tracking values actually changed significantly (more than 1 second)
        time_changed := (
            ABS(COALESCE(NEW.today_active_seconds, 0) - COALESCE(OLD.today_active_seconds, 0)) > 1 OR
            ABS(COALESCE(NEW.today_inactive_seconds, 0) - COALESCE(OLD.today_inactive_seconds, 0)) > 1
        );
        
        -- Only update if there was a meaningful time change
        IF NOT time_changed THEN
            RETURN NEW;
        END IF;
    END IF;
    
    -- Get the month_year for the changed record
    SELECT get_month_year(NEW.today_date) INTO affected_month_year;
    
    -- Only update productivity scores for recent months (within 3 months)
    -- Convert month_year string to date for proper comparison
    IF affected_month_year >= to_char((NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '3 months', 'YYYY-MM') THEN
        -- Actually calculate and update the productivity score
        -- Use a separate transaction to avoid blocking the main operation
        BEGIN
            PERFORM calculate_monthly_productivity_score(NEW.user_id, affected_month_year);
            
            -- Log the successful calculation
            RAISE LOG 'Productivity score calculated and updated for month % (user_id: %)', 
                      affected_month_year, NEW.user_id;
        EXCEPTION WHEN OTHERS THEN
            -- Log the error but don't fail the main operation
            RAISE LOG 'Error calculating productivity score for month % (user_id: %): %', 
                      affected_month_year, NEW.user_id, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger that actually calculates productivity scores
CREATE TRIGGER trg_productivity_score_on_time_change
    AFTER INSERT OR UPDATE ON activity_data
    FOR EACH ROW
    EXECUTE FUNCTION update_productivity_score_on_time_change();

-- Test the trigger by manually calculating a productivity score for user 2
-- This will help verify the function is working
DO $$
DECLARE
    test_result DECIMAL(5,2);
BEGIN
    -- Calculate productivity score for user 2 for current month
    SELECT calculate_monthly_productivity_score(2, to_char(NOW() AT TIME ZONE 'Asia/Manila', 'YYYY-MM')) INTO test_result;
    
    -- Log the result
    RAISE LOG 'Test calculation for user 2: productivity score = %', test_result;
END $$;

-- Add comment to document the fixed trigger
COMMENT ON FUNCTION update_productivity_score_on_time_change() IS 
'Actually calculates and updates productivity scores when activity_data time tracking values change significantly.';

COMMENT ON TRIGGER trg_productivity_score_on_time_change ON activity_data IS 
'Automatically calculates productivity scores when activity data time tracking values change significantly.';
