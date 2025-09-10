-- Migration 092: Add timestamp columns for clinic workflow tracking
-- This migration adds timestamp columns to track when going_to_clinic and in_clinic became true

-- Add timestamp columns for clinic workflow tracking
ALTER TABLE public.health_check_requests 
ADD COLUMN going_to_clinic_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN in_clinic_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for better query performance
CREATE INDEX idx_health_check_requests_going_to_clinic_at ON public.health_check_requests USING btree (going_to_clinic_at);
CREATE INDEX idx_health_check_requests_in_clinic_at ON public.health_check_requests USING btree (in_clinic_at);

-- Add comments for documentation
COMMENT ON COLUMN public.health_check_requests.going_to_clinic_at IS 'Timestamp when agent clicked going to clinic button';
COMMENT ON COLUMN public.health_check_requests.in_clinic_at IS 'Timestamp when nurse confirmed agent is in clinic';

-- Update the trigger function to handle timestamp updates
CREATE OR REPLACE FUNCTION public.trigger_health_check_field_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only trigger on specific field changes
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'health_check_requests' THEN
        -- Check if going_to_clinic field changed to true
        IF OLD.going_to_clinic IS DISTINCT FROM NEW.going_to_clinic AND NEW.going_to_clinic = true THEN
            -- Set timestamp when going_to_clinic becomes true
            NEW.going_to_clinic_at = NOW();
            PERFORM notify_health_check_field_update(NEW.id, 'going_to_clinic', NEW.going_to_clinic);
        ELSIF OLD.going_to_clinic IS DISTINCT FROM NEW.going_to_clinic THEN
            PERFORM notify_health_check_field_update(NEW.id, 'going_to_clinic', NEW.going_to_clinic);
        END IF;
        
        -- Check if in_clinic field changed to true
        IF OLD.in_clinic IS DISTINCT FROM NEW.in_clinic AND NEW.in_clinic = true THEN
            -- Set timestamp when in_clinic becomes true
            NEW.in_clinic_at = NOW();
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
COMMENT ON FUNCTION public.trigger_health_check_field_update() IS 'Handles automatic state transitions and timestamp tracking for clinic workflow: going_to_clinic=true sets going_to_clinic_at, in_clinic=true sets in_clinic_at and going_to_clinic=false, done=true sets in_clinic=false';
