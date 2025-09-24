-- Add function to handle health check field updates with optimized notifications
CREATE OR REPLACE FUNCTION public.notify_health_check_field_update(
    request_id_param INTEGER,
    field_name TEXT,
    field_value BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
AS $function$
DECLARE
    request_record RECORD;
BEGIN
    -- Get the request details
    SELECT hcr.*, u.email as user_email
    INTO request_record
    FROM health_check_requests hcr
    JOIN users u ON hcr.user_id = u.id
    WHERE hcr.id = request_id_param;
    
    -- If request not found, return
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Send optimized notification with user email included
    PERFORM pg_notify(
        'health_check_events',
        json_build_object(
            'event', 'request_updated',
            'request_id', request_record.id,
            'user_id', request_record.user_id,
            'nurse_id', request_record.nurse_id,
            'user_email', request_record.user_email,
            field_name, field_value,
            'updated_at', request_record.updated_at
        )::text
    );
END;
$function$;

-- Create trigger for automatic field updates
CREATE OR REPLACE FUNCTION public.trigger_health_check_field_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only trigger on specific field changes
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'health_check_requests' THEN
        -- Check if in_clinic field changed
        IF OLD.in_clinic IS DISTINCT FROM NEW.in_clinic THEN
            PERFORM notify_health_check_field_update(NEW.id, 'in_clinic', NEW.in_clinic);
        END IF;
        
        -- Check if going_to_clinic field changed
        IF OLD.going_to_clinic IS DISTINCT FROM NEW.going_to_clinic THEN
            PERFORM notify_health_check_field_update(NEW.id, 'going_to_clinic', NEW.going_to_clinic);
        END IF;
        
        -- Check if done field changed
        IF OLD.done IS DISTINCT FROM NEW.done THEN
            PERFORM notify_health_check_field_update(NEW.id, 'done', NEW.done);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS health_check_field_update_trigger ON health_check_requests;
CREATE TRIGGER health_check_field_update_trigger
    AFTER UPDATE ON health_check_requests
    FOR EACH ROW
    EXECUTE FUNCTION trigger_health_check_field_update();


















