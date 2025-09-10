-- Migration 091: Implement clinic workflow automation
-- This migration adds automatic state transitions for the clinic workflow:
-- 1. When in_clinic is set to true, automatically set going_to_clinic to false
-- 2. When done is set to true, automatically set in_clinic to false

-- Update the trigger function to handle automatic state transitions
CREATE OR REPLACE FUNCTION public.trigger_health_check_field_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only trigger on specific field changes
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'health_check_requests' THEN
        -- Check if in_clinic field changed to true
        IF OLD.in_clinic IS DISTINCT FROM NEW.in_clinic AND NEW.in_clinic = true THEN
            -- Automatically set going_to_clinic to false when in_clinic becomes true
            NEW.going_to_clinic = false;
            PERFORM notify_health_check_field_update(NEW.id, 'in_clinic', NEW.in_clinic);
            PERFORM notify_health_check_field_update(NEW.id, 'going_to_clinic', false);
        ELSIF OLD.in_clinic IS DISTINCT FROM NEW.in_clinic THEN
            PERFORM notify_health_check_field_update(NEW.id, 'in_clinic', NEW.in_clinic);
        END IF;
        
        -- Check if done field changed to true
        IF OLD.done IS DISTINCT FROM NEW.done AND NEW.done = true THEN
            -- Automatically set in_clinic to false when done becomes true
            NEW.in_clinic = false;
            PERFORM notify_health_check_field_update(NEW.id, 'done', NEW.done);
            PERFORM notify_health_check_field_update(NEW.id, 'in_clinic', false);
        ELSIF OLD.done IS DISTINCT FROM NEW.done THEN
            PERFORM notify_health_check_field_update(NEW.id, 'done', NEW.done);
        END IF;
        
        -- Check if going_to_clinic field changed (but not due to automatic transition)
        IF OLD.going_to_clinic IS DISTINCT FROM NEW.going_to_clinic THEN
            PERFORM notify_health_check_field_update(NEW.id, 'going_to_clinic', NEW.going_to_clinic);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Update the trigger to use BEFORE UPDATE instead of AFTER UPDATE
-- This allows us to modify the NEW record before it's saved
DROP TRIGGER IF EXISTS health_check_field_update_trigger ON health_check_requests;
CREATE TRIGGER health_check_field_update_trigger
    BEFORE UPDATE ON health_check_requests
    FOR EACH ROW
    EXECUTE FUNCTION trigger_health_check_field_update();

-- Add comments for documentation
COMMENT ON FUNCTION public.trigger_health_check_field_update() IS 'Handles automatic state transitions for clinic workflow: in_clinic=true sets going_to_clinic=false, done=true sets in_clinic=false';
