-- Migration 093: Update health check notifications to include timestamps
-- This migration updates the notification function to include the new timestamp fields

-- Update the function to include timestamp fields in notifications
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
    -- Get the request details including timestamps
    SELECT hcr.*, u.email as user_email
    INTO request_record
    FROM health_check_requests hcr
    JOIN users u ON hcr.user_id = u.id
    WHERE hcr.id = request_id_param;
    
    -- If request not found, return
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Send optimized notification with user email and timestamps included
    PERFORM pg_notify(
        'health_check_events',
        json_build_object(
            'event', 'request_updated',
            'request_id', request_record.id,
            'user_id', request_record.user_id,
            'nurse_id', request_record.nurse_id,
            'user_email', request_record.user_email,
            field_name, field_value,
            'going_to_clinic_at', request_record.going_to_clinic_at,
            'in_clinic_at', request_record.in_clinic_at,
            'updated_at', request_record.updated_at
        )::text
    );
END;
$function$;

-- Add comments for documentation
COMMENT ON FUNCTION public.notify_health_check_field_update(INTEGER, TEXT, BOOLEAN) IS 'Sends real-time notifications for health check field updates including timestamp tracking';
