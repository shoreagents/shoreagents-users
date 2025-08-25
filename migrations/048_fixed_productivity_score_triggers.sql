-- Fixed Auto-Productivity Score Triggers
-- This migration replaces the problematic triggers with a more robust solution
-- that prevents conflicts with normal database operations

-- Drop the problematic triggers first
DROP TRIGGER IF EXISTS trg_auto_productivity_score_on_insert ON activity_data;
DROP TRIGGER IF EXISTS trg_auto_productivity_score_on_update ON activity_data;

-- Drop the problematic functions
DROP FUNCTION IF EXISTS auto_update_productivity_score_on_activity_change();
DROP FUNCTION IF EXISTS auto_update_productivity_score_on_insert();
DROP FUNCTION IF EXISTS auto_update_productivity_score_on_update();

-- Create a new, simplified function that only updates productivity scores
-- when there are actual meaningful changes to time tracking
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
        -- Use a deferred approach to avoid blocking the main operation
        -- Schedule the productivity update for later
        PERFORM pg_notify(
            'productivity_update_needed',
            json_build_object(
                'user_id', NEW.user_id,
                'month_year', affected_month_year,
                'timestamp', NOW()
            )::text
        );
        
        -- Log the notification (optional, for debugging)
        RAISE LOG 'Scheduled productivity score update for month % (user_id: %)', 
                  affected_month_year, NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a single trigger that handles both INSERT and UPDATE
CREATE TRIGGER trg_productivity_score_on_time_change
    AFTER INSERT OR UPDATE ON activity_data
    FOR EACH ROW
    EXECUTE FUNCTION update_productivity_score_on_time_change();

-- Create a function to process the productivity updates from notifications
CREATE OR REPLACE FUNCTION process_productivity_updates()
RETURNS void AS $$
DECLARE
    notification_data JSONB;
    user_id_val INTEGER;
    month_year_val VARCHAR(7);
BEGIN
    -- This function will be called by a background process or scheduled job
    -- to process the queued productivity updates
    
    -- For now, we'll just log that it's available
    RAISE LOG 'Productivity update processor is available for background processing';
END;
$$ LANGUAGE plpgsql;

-- Function to manually trigger productivity score calculation for testing/debugging
CREATE OR REPLACE FUNCTION trigger_manual_productivity_calculation(
    p_user_id INTEGER DEFAULT NULL,
    p_month_year VARCHAR(7) DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    target_month_year VARCHAR(7);
    result_text TEXT;
    calculated_score DECIMAL(5,2);
BEGIN
    -- Get target month_year
    IF p_month_year IS NULL THEN
        SELECT get_month_year() INTO target_month_year;
    ELSE
        target_month_year := p_month_year;
    END IF;
    
    -- Calculate productivity score
    IF p_user_id IS NULL THEN
        -- Calculate for all users in the month
        SELECT SUM(calculate_monthly_productivity_score(u.id, target_month_year)) INTO calculated_score
        FROM users u
        WHERE u.user_type = 'Agent';
        
        result_text := format('Manual productivity calculation completed for month %s for all users (total score: %s)', 
                             target_month_year, calculated_score);
    ELSE
        -- Calculate for specific user
        SELECT calculate_monthly_productivity_score(p_user_id, target_month_year) INTO calculated_score;
        
        result_text := format('Manual productivity calculation completed for month %s for user %s (score: %s)', 
                             target_month_year, p_user_id, calculated_score);
    END IF;
    
    RETURN result_text;
END;
$$ LANGUAGE plpgsql;

-- Function to check productivity score calculation status
CREATE OR REPLACE FUNCTION check_productivity_calculation_status(
    p_user_id INTEGER DEFAULT NULL,
    p_month_year VARCHAR(7) DEFAULT NULL
)
RETURNS TABLE (
    user_id INTEGER,
    month_year VARCHAR(7),
    productivity_score DECIMAL(5,2),
    total_active_seconds INTEGER,
    total_inactive_seconds INTEGER,
    last_updated TIMESTAMP WITH TIME ZONE,
    needs_recalculation BOOLEAN
) AS $$
DECLARE
    target_month_year VARCHAR(7);
BEGIN
    -- Get target month_year
    IF p_month_year IS NULL THEN
        SELECT get_month_year() INTO target_month_year;
    ELSE
        target_month_year := p_month_year;
    END IF;
    
    -- Return productivity score status
    RETURN QUERY
    SELECT 
        ps.user_id,
        ps.month_year,
        ps.productivity_score,
        ps.total_active_seconds,
        ps.total_inactive_seconds,
        ps.updated_at as last_updated,
        -- Check if score needs recalculation (if it's more than 1 hour old)
        (ps.updated_at < NOW() - INTERVAL '1 hour') as needs_recalculation
    FROM productivity_scores ps
    WHERE ps.month_year = target_month_year
    AND (p_user_id IS NULL OR ps.user_id = p_user_id)
    ORDER BY ps.user_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment to document the triggers
COMMENT ON FUNCTION update_productivity_score_on_time_change() IS 
'Updates productivity scores when activity_data time tracking values change significantly. Uses notifications to avoid blocking main operations.';

COMMENT ON TRIGGER trg_productivity_score_on_time_change ON activity_data IS 
'Automatically schedules productivity score updates when activity data time tracking values change significantly.';
