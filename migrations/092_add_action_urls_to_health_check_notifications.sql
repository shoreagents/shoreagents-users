-- Add action URLs to existing health check notifications
-- This migration updates the health check notification function to include action_url in the payload

-- Update the existing function to include action_url in all health check notifications
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
                'event_type', 'request_created',
                'action_url', '/status/health'
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
                'event_type', 'request_created',
                'action_url', '/status/health'
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
                        'event_type', 'request_approved',
                        'action_url', '/status/health'
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
                        'event_type', 'request_rejected',
                        'action_url', '/status/health'
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
                        'event_type', 'request_completed',
                        'action_url', '/status/health'
                    )
                );
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

COMMENT ON FUNCTION public.notify_health_check_event() IS 'Sends real-time notifications for health check events with action URLs for proper navigation';
