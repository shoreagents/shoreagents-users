-- Add Real-time Productivity Score Updates
-- This migration enhances the productivity trigger to emit real-time updates via WebSocket
-- when productivity scores are calculated and updated

-- First, drop the existing trigger
DROP TRIGGER IF EXISTS trg_productivity_score_on_time_change ON activity_data;

-- Drop the existing function
DROP FUNCTION IF EXISTS update_productivity_score_on_time_change();

-- Create an enhanced function that emits real-time updates
CREATE OR REPLACE FUNCTION update_productivity_score_on_time_change()
RETURNS TRIGGER AS $$
DECLARE
    affected_month_year VARCHAR(7);
    time_changed BOOLEAN;
    old_score DECIMAL(5,2);
    new_score DECIMAL(5,2);
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
        -- Get the old productivity score before updating
        SELECT COALESCE(productivity_score, 0) INTO old_score
        FROM productivity_scores 
        WHERE user_id = NEW.user_id AND month_year = affected_month_year;
        
        -- Actually calculate and update the productivity score
        -- Use a separate transaction to avoid blocking the main operation
        BEGIN
            PERFORM calculate_monthly_productivity_score(NEW.user_id, affected_month_year);
            
            -- Get the new productivity score after updating
            SELECT COALESCE(productivity_score, 0) INTO new_score
            FROM productivity_scores 
            WHERE user_id = NEW.user_id AND month_year = affected_month_year;
            
            -- Log the successful calculation
            RAISE LOG 'Productivity score calculated and updated for month % (user_id: %): % -> %', 
                      affected_month_year, NEW.user_id, old_score, new_score;
            
            -- Emit real-time update via WebSocket if score changed
            IF old_score != new_score THEN
                -- Use pg_notify to signal that a productivity score was updated
                -- The socket server will listen for this notification and emit updates
                PERFORM pg_notify(
                    'productivity_score_updated',
                    json_build_object(
                        'user_id', NEW.user_id,
                        'month_year', affected_month_year,
                        'old_score', old_score,
                        'new_score', new_score,
                        'timestamp', NOW()
                    )::text
                );
                
                RAISE LOG 'Real-time productivity update notification sent for user %: % -> %', 
                          NEW.user_id, old_score, new_score;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log the error but don't fail the main operation
            RAISE LOG 'Error calculating productivity score for month % (user_id: %): %', 
                      affected_month_year, NEW.user_id, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the enhanced trigger
CREATE TRIGGER trg_productivity_score_on_time_change
    AFTER INSERT OR UPDATE ON activity_data
    FOR EACH ROW
    EXECUTE FUNCTION update_productivity_score_on_time_change();

-- Add comment to document the enhanced trigger
COMMENT ON FUNCTION update_productivity_score_on_time_change() IS 
'Calculates productivity scores and emits real-time WebSocket updates when activity_data time tracking values change significantly.';

COMMENT ON TRIGGER trg_productivity_score_on_time_change ON activity_data IS 
'Automatically calculates productivity scores and sends real-time updates when activity data time tracking values change significantly.';
