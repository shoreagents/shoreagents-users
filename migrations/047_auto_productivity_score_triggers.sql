-- Auto-Productivity Score Triggers
-- This migration creates triggers that automatically update productivity scores
-- whenever activity_data changes, eliminating the need for manual recalculation

-- Function to auto-update productivity score when activity_data changes
CREATE OR REPLACE FUNCTION auto_update_productivity_score_on_activity_change()
RETURNS TRIGGER AS $$
DECLARE
    affected_month_year VARCHAR(7);
    current_month_year VARCHAR(7);
    is_productivity_update BOOLEAN;
BEGIN
    -- Check if we're already in a productivity update context to prevent infinite loops
    is_productivity_update := (TG_OP = 'UPDATE' AND 
                              OLD.today_active_seconds IS NOT NULL AND 
                              NEW.today_active_seconds IS NOT NULL AND
                              OLD.today_inactive_seconds IS NOT NULL AND 
                              NEW.today_inactive_seconds IS NOT NULL);
    
    -- Skip if this is a productivity-related update to prevent conflicts
    IF is_productivity_update THEN
        RETURN NEW;
    END IF;
    
    -- Get the month_year for the changed record
    SELECT get_month_year(NEW.today_date) INTO affected_month_year;
    
    -- Get current month_year for comparison
    SELECT get_month_year() INTO current_month_year;
    
    -- Only update productivity scores for recent months (within 3 months)
    -- This prevents unnecessary updates for old data
    IF affected_month_year >= (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '3 months' THEN
        -- Use a separate transaction to avoid trigger conflicts
        BEGIN
            -- Automatically calculate and update productivity score for the affected month
            PERFORM calculate_monthly_productivity_score(NEW.user_id, affected_month_year);
            
            -- Log the auto-update (optional, for debugging)
            RAISE LOG 'Auto-updated productivity score for month % (user_id: %)', 
                      affected_month_year, NEW.user_id;
        EXCEPTION WHEN OTHERS THEN
            -- Log the error but don't fail the main operation
            RAISE LOG 'Error updating productivity score for month % (user_id: %): %', 
                      affected_month_year, NEW.user_id, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update productivity score when activity_data is inserted
CREATE OR REPLACE FUNCTION auto_update_productivity_score_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the main function
    RETURN auto_update_productivity_score_on_activity_change();
END;
$$ LANGUAGE plpgsql;

-- Function to auto-update productivity score when activity_data is updated
CREATE OR REPLACE FUNCTION auto_update_productivity_score_on_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if the time tracking values actually changed
    IF OLD.today_active_seconds != NEW.today_active_seconds OR 
       OLD.today_inactive_seconds != NEW.today_inactive_seconds THEN
        -- Call the main function
        RETURN auto_update_productivity_score_on_activity_change();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update productivity score when activity_data is inserted
CREATE TRIGGER trg_auto_productivity_score_on_insert
    AFTER INSERT ON activity_data
    FOR EACH ROW
    EXECUTE FUNCTION auto_update_productivity_score_on_insert();

-- Trigger to auto-update productivity score when activity_data is updated
CREATE TRIGGER trg_auto_productivity_score_on_update
    AFTER UPDATE ON activity_data
    FOR EACH ROW
    EXECUTE FUNCTION auto_update_productivity_score_on_update();

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
COMMENT ON FUNCTION auto_update_productivity_score_on_activity_change() IS 
'Automatically updates productivity scores whenever activity_data changes. This ensures real-time productivity tracking without manual API calls.';

COMMENT ON TRIGGER trg_auto_productivity_score_on_insert ON activity_data IS 
'Automatically calculates productivity scores when new activity data is inserted.';

COMMENT ON TRIGGER trg_auto_productivity_score_on_update ON activity_data IS 
'Automatically recalculates productivity scores when activity data time tracking values are updated.';
