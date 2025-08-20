-- Migration: 045_health_check_schema.sql
-- Description: Create health check system schema with real-time notifications
-- Date: 2025-01-20

-- Create health check requests table
CREATE TABLE IF NOT EXISTS public.health_check_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    nurse_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    complaint TEXT,
    symptoms TEXT,
    request_time TIMESTAMPTZ DEFAULT NOW() NULL,
    approved_time TIMESTAMPTZ NULL,
    completed_time TIMESTAMPTZ NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NULL
);

-- Create health check records table
CREATE TABLE IF NOT EXISTS public.health_check_records (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES public.health_check_requests(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    nurse_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL,
    visit_time TIME NOT NULL,
    chief_complaint TEXT NOT NULL,
    diagnosis TEXT,
    treatment_plan TEXT,
    medicines_issued TEXT,
    supplies_issued TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    follow_up_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NULL
);

-- Create health check availability table
CREATE TABLE IF NOT EXISTS public.health_check_availability (
    id SERIAL PRIMARY KEY,
    nurse_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 1=Monday, etc.
    shift_start TIME NOT NULL,
    shift_end TIME NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    break_start TIME,
    break_end TIME,
    created_at TIMESTAMPTZ DEFAULT NOW() NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_health_check_requests_user_id ON public.health_check_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_health_check_requests_nurse_id ON public.health_check_requests(nurse_id);
CREATE INDEX IF NOT EXISTS idx_health_check_requests_status ON public.health_check_requests(status);
CREATE INDEX IF NOT EXISTS idx_health_check_requests_request_time ON public.health_check_requests(request_time);

CREATE INDEX IF NOT EXISTS idx_health_check_records_user_id ON public.health_check_records(user_id);
CREATE INDEX IF NOT EXISTS idx_health_check_records_nurse_id ON public.health_check_records(nurse_id);
CREATE INDEX IF NOT EXISTS idx_health_check_records_visit_date ON public.health_check_records(visit_date);
CREATE INDEX IF NOT EXISTS idx_health_check_records_request_id ON public.health_check_records(request_id);

CREATE INDEX IF NOT EXISTS idx_health_check_availability_nurse_id ON public.health_check_availability(nurse_id);
CREATE INDEX IF NOT EXISTS idx_health_check_availability_day_of_week ON public.health_check_availability(day_of_week);

-- Create unique constraints for ON CONFLICT clauses
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_check_availability_unique ON public.health_check_availability(nurse_id, day_of_week);
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_check_records_unique ON public.health_check_records(user_id, nurse_id, visit_date, visit_time);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_health_check_requests_updated_at 
    BEFORE UPDATE ON public.health_check_requests 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_health_check_records_updated_at 
    BEFORE UPDATE ON public.health_check_records 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_health_check_availability_updated_at 
    BEFORE UPDATE ON public.health_check_availability 
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to notify health check events
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
        WHERE u.role = 'Internal' 
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

-- Create trigger for health check events
CREATE TRIGGER health_check_events_trigger
    AFTER INSERT OR UPDATE ON public.health_check_requests
    FOR EACH ROW EXECUTE FUNCTION public.notify_health_check_event();

-- Insert default nurse availability (Nurse Ron - user_id 1)
INSERT INTO public.health_check_availability (nurse_id, day_of_week, shift_start, shift_end, is_available, break_start, break_end)
VALUES 
    (1, 1, '06:00:00', '15:00:00', TRUE, '10:00:00', '10:15:00'), -- Monday
    (1, 2, '06:00:00', '15:00:00', TRUE, '10:00:00', '10:15:00'), -- Tuesday
    (1, 3, '06:00:00', '15:00:00', TRUE, '10:00:00', '10:15:00'), -- Wednesday
    (1, 4, '06:00:00', '15:00:00', TRUE, '10:00:00', '10:15:00'), -- Thursday
    (1, 5, '06:00:00', '15:00:00', TRUE, '10:00:00', '10:15:00'), -- Friday
    (1, 6, '06:00:00', '15:00:00', TRUE, '10:00:00', '10:15:00'), -- Saturday
    (1, 0, '06:00:00', '15:00:00', TRUE, '10:00:00', '10:15:00')  -- Sunday
ON CONFLICT (nurse_id, day_of_week) DO NOTHING;

-- Insert sample health check records for user_id 1 (if they exist)
INSERT INTO public.health_check_records (request_id, user_id, nurse_id, visit_date, visit_time, chief_complaint, diagnosis, treatment_plan, medicines_issued, supplies_issued, follow_up_required)
VALUES 
    (NULL, 1, 1, '2024-01-15', '10:30:00', 'Headache and mild fever', 'Tension headache with low-grade fever', 'Rest and hydration', 'Paracetamol 500mg (2 tablets)', 'Thermometer reading chart', FALSE),
    (NULL, 1, 1, '2024-01-12', '15:20:00', 'Eye strain from computer work', 'Computer vision syndrome', 'Eye exercises and breaks', 'Eye drops (artificial tears)', 'Computer usage guidelines sheet', FALSE),
    (NULL, 1, 1, '2024-01-10', '09:15:00', 'Back pain from sitting', 'Musculoskeletal strain', 'Posture correction and stretching', 'Ibuprofen 400mg', 'Posture correction guide, Lumbar support cushion', TRUE),
    (NULL, 1, 1, '2024-01-08', '14:15:00', 'Minor cut on finger', 'Superficial laceration', 'Wound care and monitoring', 'Antiseptic solution', 'Adhesive bandage, Gauze pad', FALSE),
    (NULL, 1, 1, '2024-01-05', '11:00:00', 'Seasonal allergies', 'Allergic rhinitis', 'Avoidance and medication', 'Antihistamine tablets', 'Allergy management pamphlet', FALSE)
ON CONFLICT (user_id, nurse_id, visit_date, visit_time) DO NOTHING;

-- Grant permissions (using public role for now)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_check_requests TO public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_check_records TO public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_check_availability TO public;

-- Note: RLS policies removed as they require Supabase auth schema
-- You can add custom access control in your application layer

COMMENT ON TABLE public.health_check_requests IS 'Health check requests submitted by users';
COMMENT ON TABLE public.health_check_records IS 'Health check records and visit details';
COMMENT ON TABLE public.health_check_availability IS 'Nurse availability and shift schedules';
