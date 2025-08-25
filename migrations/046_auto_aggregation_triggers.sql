-- Auto-Aggregation Triggers for Weekly and Monthly Activity Data
-- This migration creates triggers that automatically update weekly/monthly summaries
-- whenever activity_data changes, eliminating the need for 15-second frontend polling

-- Function to auto-aggregate weekly data when activity_data changes
CREATE OR REPLACE FUNCTION auto_aggregate_weekly_on_activity_change()
RETURNS TRIGGER AS $$
DECLARE
    week_start DATE;
    week_end DATE;
    affected_week_start DATE;
BEGIN
    -- Get the week start date for the changed record
    SELECT get_week_start_date(NEW.today_date) INTO affected_week_start;
    
    -- Only aggregate if the change affects data in the current week or recent weeks
    -- This prevents unnecessary aggregation for old data
    IF NEW.today_date >= (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '14 days' THEN
        -- Aggregate the specific week that was affected
        PERFORM aggregate_weekly_activity(affected_week_start);
        
        -- Log the auto-aggregation (optional, for debugging)
        RAISE LOG 'Auto-aggregated weekly activity for week starting % (user_id: %)', 
                  affected_week_start, NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-aggregate monthly data when activity_data changes
CREATE OR REPLACE FUNCTION auto_aggregate_monthly_on_activity_change()
RETURNS TRIGGER AS $$
DECLARE
    month_start DATE;
    affected_month_start DATE;
BEGIN
    -- Get the month start date for the changed record
    SELECT get_month_start_date(NEW.today_date) INTO affected_month_start;
    
    -- Only aggregate if the change affects data in the current month or recent months
    -- This prevents unnecessary aggregation for old data
    IF NEW.today_date >= (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '60 days' THEN
        -- Aggregate the specific month that was affected
        PERFORM aggregate_monthly_activity(affected_month_start);
        
        -- Log the auto-aggregation (optional, for debugging)
        RAISE LOG 'Auto-aggregated monthly activity for month starting % (user_id: %)', 
                  affected_month_start, NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-aggregate both weekly and monthly data
-- This is more efficient than calling both functions separately
CREATE OR REPLACE FUNCTION auto_aggregate_all_on_activity_change()
RETURNS TRIGGER AS $$
DECLARE
    week_start DATE;
    month_start DATE;
BEGIN
    -- Only process if the change affects recent data
    IF NEW.today_date >= (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '60 days' THEN
        -- Get the week and month start dates for the changed record
        SELECT get_week_start_date(NEW.today_date) INTO week_start;
        SELECT get_month_start_date(NEW.today_date) INTO month_start;
        
        -- Aggregate both weekly and monthly data
        PERFORM aggregate_weekly_activity(week_start);
        PERFORM aggregate_monthly_activity(month_start);
        
        -- Log the auto-aggregation (optional, for debugging)
        RAISE LOG 'Auto-aggregated weekly and monthly activity for date % (user_id: %, week: %, month: %)', 
                  NEW.today_date, NEW.user_id, week_start, month_start;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic aggregation
-- Note: We'll use the combined function for efficiency

-- Trigger to auto-aggregate when activity_data is inserted
CREATE TRIGGER trg_auto_aggregate_on_insert
    AFTER INSERT ON activity_data
    FOR EACH ROW
    EXECUTE FUNCTION auto_aggregate_all_on_activity_change();

-- Trigger to auto-aggregate when activity_data is updated
CREATE TRIGGER trg_auto_aggregate_on_update
    AFTER UPDATE ON activity_data
    FOR EACH ROW
    EXECUTE FUNCTION auto_aggregate_all_on_activity_change();

-- Note: We don't need a DELETE trigger since we're not deleting activity_data rows
-- The cleanup functions handle old data removal

-- Function to manually trigger aggregation for testing/debugging
CREATE OR REPLACE FUNCTION trigger_manual_aggregation(
    p_user_id INTEGER DEFAULT NULL,
    p_date DATE DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')::date
)
RETURNS TEXT AS $$
DECLARE
    week_start DATE;
    month_start DATE;
    result_text TEXT;
BEGIN
    -- Get week and month start dates
    SELECT get_week_start_date(p_date) INTO week_start;
    SELECT get_month_start_date(p_date) INTO month_start;
    
    -- Aggregate data
    PERFORM aggregate_weekly_activity(week_start);
    PERFORM aggregate_monthly_activity(month_start);
    
    -- Build result message
    result_text := format('Manual aggregation completed for date %s (week: %s, month: %s)', 
                         p_date, week_start, month_start);
    
    IF p_user_id IS NOT NULL THEN
        result_text := result_text || format(' for user %s', p_user_id);
    END IF;
    
    RETURN result_text;
END;
$$ LANGUAGE plpgsql;

-- Function to check aggregation status
CREATE OR REPLACE FUNCTION check_aggregation_status(
    p_user_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
    user_id INTEGER,
    today_date DATE,
    week_start_date DATE,
    month_start_date DATE,
    weekly_aggregated BOOLEAN,
    monthly_aggregated BOOLEAN,
    last_weekly_update TIMESTAMP WITH TIME ZONE,
    last_monthly_update TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ad.user_id,
        ad.today_date,
        get_week_start_date(ad.today_date) as week_start_date,
        get_month_start_date(ad.today_date) as month_start_date,
        CASE WHEN was.week_start_date IS NOT NULL THEN true ELSE false END as weekly_aggregated,
        CASE WHEN mas.month_start_date IS NOT NULL THEN true ELSE false END as monthly_aggregated,
        was.updated_at as last_weekly_update,
        mas.updated_at as last_monthly_update
    FROM activity_data ad
    LEFT JOIN weekly_activity_summary was ON 
        was.user_id = ad.user_id AND 
        was.week_start_date = get_week_start_date(ad.today_date)
    LEFT JOIN monthly_activity_summary mas ON 
        mas.user_id = ad.user_id AND 
        mas.month_start_date = get_month_start_date(ad.today_date)
    WHERE (p_user_id IS NULL OR ad.user_id = p_user_id)
    AND ad.today_date >= (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '30 days'
    ORDER BY ad.today_date DESC, ad.user_id;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION auto_aggregate_all_on_activity_change() IS 
'Automatically aggregates weekly and monthly activity data whenever activity_data changes. 
This eliminates the need for frontend polling and ensures data is always up-to-date.';

COMMENT ON FUNCTION trigger_manual_aggregation(INTEGER, DATE) IS 
'Manually triggers aggregation for testing or debugging purposes. 
Can be called with specific user_id and date parameters.';

COMMENT ON FUNCTION check_aggregation_status(INTEGER) IS 
'Checks the aggregation status for recent activity data. 
Returns whether weekly and monthly summaries are up-to-date.';

-- Log the completion of this migration
DO $$
BEGIN
    RAISE LOG 'Migration 046_auto_aggregation_triggers completed successfully. 
               Auto-aggregation triggers are now active for weekly and monthly activity data.';
END $$;
