-- Fix the notify_health_check_event function to use correct column names
-- The function is trying to access u.role but it should be u.user_type

DROP FUNCTION IF EXISTS notify_health_check_event() CASCADE;

-- Create the fixed function
CREATE OR REPLACE FUNCTION public.notify_health_check_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify when health check request is created
    IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'health_check_requests' THEN
        PERFORM pg_notify(
            'health_check_events',
            json_build_object(
                'event', 'request_created',
                'request_id', NEW.id,
                'user_id', NEW.user_id,
                'nurse_id', NEW.nurse_id,
                'status', NEW.status,
                'priority', NEW.priority,
                'complaint', NEW.complaint,
                'request_time', NEW.request_time
            )::text
        );
        
        -- Create notification for the user using existing notifications table
        INSERT INTO public.notifications (user_id, category, type, title, message, payload)
        VALUES (
            NEW.user_id,
            'health_check',
            'info',
            'Health Check Request Submitted',
            'Your health check request has been submitted and is pending approval.',
            json_build_object(
                'request_id', NEW.id,
                'status', NEW.status,
                'priority', NEW.priority,
                'event_type', 'request_created'
            )
        );
        
        -- Create notification for nurses (if any are available) using existing notifications table
        INSERT INTO public.notifications (user_id, category, type, title, message, payload)
        SELECT 
            u.id,
            'health_check',
            'info',
            'New Health Check Request',
            'A new health check request requires attention.',
            json_build_object(
                'request_id', NEW.id,
                'requesting_user_id', NEW.user_id,
                'priority', NEW.priority,
                'event_type', 'request_created'
            )
        FROM public.users u
        WHERE u.user_type = 'Internal' 
        AND u.id IN (
            SELECT DISTINCT nurse_id 
            FROM public.health_check_availability 
            WHERE is_available = TRUE
        );
        
        RETURN NEW;
    END IF;
    
    -- Notify when health check request status changes
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'health_check_requests' THEN
        IF OLD.status != NEW.status THEN
            PERFORM pg_notify(
                'health_check_events',
                json_build_object(
                    'event', 'request_status_changed',
                    'request_id', NEW.id,
                    'user_id', NEW.user_id,
                    'nurse_id', NEW.nurse_id,
                    'old_status', OLD.status,
                    'new_status', NEW.status,
                    'updated_at', NEW.updated_at
                )::text
            );
            
            -- Create appropriate notification based on status change using existing notifications table
            IF NEW.status = 'approved' THEN
                INSERT INTO public.notifications (user_id, category, type, title, message, payload)
                VALUES (
                    NEW.user_id,
                    'health_check',
                    'success',
                    'Health Check Request Approved',
                    'Your health check request has been approved. Please proceed to the clinic.',
                    json_build_object(
                        'request_id', NEW.id,
                        'status', NEW.status,
                        'event_type', 'request_approved'
                    )
                );
            ELSIF NEW.status = 'rejected' THEN
                INSERT INTO public.notifications (user_id, category, type, title, message, payload)
                VALUES (
                    NEW.user_id,
                    'health_check',
                    'error',
                    'Health Check Request Rejected',
                    'Your health check request has been rejected. Please contact the nurse for more information.',
                    json_build_object(
                        'request_id', NEW.id,
                        'status', NEW.status,
                        'event_type', 'request_rejected'
                    )
                );
            ELSIF NEW.status = 'completed' THEN
                INSERT INTO public.notifications (user_id, category, type, title, message, payload)
                VALUES (
                    NEW.user_id,
                    'health_check',
                    'success',
                    'Health Check Completed',
                    'Your health check has been completed. Check your records for details.',
                    json_build_object(
                        'request_id', NEW.id,
                        'status', NEW.status,
                        'event_type', 'request_completed'
                    )
                );
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate the trigger
DROP TRIGGER IF EXISTS health_check_events_trigger ON public.health_check_requests;

CREATE TRIGGER health_check_events_trigger
    AFTER INSERT OR UPDATE ON public.health_check_requests
    FOR EACH ROW EXECUTE FUNCTION public.notify_health_check_event();
