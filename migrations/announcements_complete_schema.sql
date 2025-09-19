-- =====================================================
-- Complete Announcements System Schema
-- Consolidated from all migration files
-- Description: Complete announcement system with scheduling, 
--              real-time notifications, and user targeting
-- =====================================================

-- =====================================================
-- ENUMS
-- =====================================================

-- Create announcement status enum
CREATE TYPE public."announcement_status_enum" AS ENUM (
    'draft',
    'scheduled',
    'active',
    'expired',
    'cancelled'
);

-- Create announcement priority enum
CREATE TYPE public."announcement_priority_enum" AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


-- =====================================================
-- TABLES
-- =====================================================

-- Create announcements table
CREATE TABLE public.announcements (
    id serial4 NOT NULL,
    title varchar(255) NOT NULL,
    message text NOT NULL,
    priority public."announcement_priority_enum" DEFAULT 'medium'::announcement_priority_enum NOT NULL,
    status public."announcement_status_enum" DEFAULT 'draft'::announcement_status_enum NOT NULL,
    
    -- Scheduling fields
    scheduled_at timestamptz NULL,
    expires_at timestamptz NULL,
    sent_at timestamptz NULL,
    
    -- User targeting
    assigned_user_ids _int4 NOT NULL, -- Array of user IDs who should receive this announcement
    
    -- Display settings
    allow_dismiss boolean DEFAULT true NULL,
    
    -- Metadata
    created_by int4 NOT NULL,
    created_at timestamptz DEFAULT now() NULL,
    updated_at timestamptz DEFAULT now() NULL,
    
    -- Constraints
    CONSTRAINT announcements_pkey PRIMARY KEY (id),
    CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT announcements_scheduled_at_check CHECK (scheduled_at IS NULL OR scheduled_at > created_at),
    CONSTRAINT announcements_expires_at_check CHECK (expires_at IS NULL OR expires_at > scheduled_at),
    CONSTRAINT announcements_assigned_users_check CHECK (
        (assigned_user_ids IS NOT NULL) AND (array_length(assigned_user_ids, 1) > 0)
    )
);

-- Create announcement_assignments table for detailed user targeting
CREATE TABLE public.announcement_assignments (
    id serial4 NOT NULL,
    announcement_id int4 NOT NULL,
    user_id int4 NOT NULL,
    dismissed_at timestamptz NULL,
    
    CONSTRAINT announcement_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT announcement_assignments_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE,
    CONSTRAINT announcement_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT announcement_assignments_unique UNIQUE (announcement_id, user_id)
);


-- =====================================================
-- INDEXES
-- =====================================================

-- Announcements table indexes
CREATE INDEX idx_announcements_status ON public.announcements USING btree (status);
CREATE INDEX idx_announcements_scheduled_at ON public.announcements USING btree (scheduled_at);
CREATE INDEX idx_announcements_expires_at ON public.announcements USING btree (expires_at);
CREATE INDEX idx_announcements_created_by ON public.announcements USING btree (created_by);
CREATE INDEX idx_announcements_assigned_user_ids ON public.announcements USING gin (assigned_user_ids);
CREATE INDEX idx_announcements_status_scheduled ON public.announcements USING btree (status, scheduled_at);

-- Announcement assignments table indexes
CREATE INDEX idx_announcement_assignments_announcement_id ON public.announcement_assignments USING btree (announcement_id);
CREATE INDEX idx_announcement_assignments_user_id ON public.announcement_assignments USING btree (user_id);


-- =====================================================
-- TRIGGERS
-- =====================================================

-- Create updated_at trigger for announcements
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON public.announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_announcements_updated_at();

-- Function to notify about announcement changes
CREATE OR REPLACE FUNCTION notify_announcement_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_payload jsonb;
BEGIN
    -- Build notification payload
    notification_payload := jsonb_build_object(
        'type', 'announcement_change',
        'announcement_id', COALESCE(NEW.id, OLD.id),
        'action', TG_OP,
        'title', COALESCE(NEW.title, OLD.title),
        'status', COALESCE(NEW.status, OLD.status),
        'created_by', COALESCE(NEW.created_by, OLD.created_by),
        'updated_at', now()
    );
    
    -- Add additional fields for different operations
    IF TG_OP = 'INSERT' THEN
        notification_payload := notification_payload || jsonb_build_object(
            'message', NEW.message,
            'priority', NEW.priority,
            'scheduled_at', NEW.scheduled_at
        );
    ELSIF TG_OP = 'UPDATE' THEN
        notification_payload := notification_payload || jsonb_build_object(
            'old_status', OLD.status,
            'new_status', NEW.status,
            'status_changed', OLD.status != NEW.status
        );
    END IF;
    
    -- Send notification
    PERFORM pg_notify('announcements', notification_payload::text);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for announcement changes
CREATE TRIGGER announcements_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.announcements
    FOR EACH ROW
    EXECUTE FUNCTION notify_announcement_change();

-- =====================================================
-- CORE FUNCTIONS
-- =====================================================

-- Function to create announcement assignments based on assigned_user_ids
CREATE OR REPLACE FUNCTION create_announcement_assignments(announcement_id_param int4)
RETURNS void AS $$
DECLARE
    announcement_record public.announcements%ROWTYPE;
    user_id_param int4;
BEGIN
    -- Get announcement details
    SELECT * INTO announcement_record 
    FROM public.announcements 
    WHERE id = announcement_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Announcement with id % not found', announcement_id_param;
    END IF;
    
    -- Clear existing assignments
    DELETE FROM public.announcement_assignments WHERE announcement_id = announcement_id_param;
    
    -- Create assignments for assigned users
    IF announcement_record.assigned_user_ids IS NOT NULL AND array_length(announcement_record.assigned_user_ids, 1) > 0 THEN
        FOREACH user_id_param IN ARRAY announcement_record.assigned_user_ids
        LOOP
            -- Check if user exists
            IF EXISTS (SELECT 1 FROM public.users WHERE id = user_id_param) THEN
                -- Insert assignment if it doesn't exist
                INSERT INTO public.announcement_assignments (announcement_id, user_id)
                VALUES (announcement_id_param, user_id_param)
                ON CONFLICT (announcement_id, user_id) DO NOTHING;
            END IF;
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to send announcement to assigned users
CREATE OR REPLACE FUNCTION send_announcement(announcement_id_param int4)
RETURNS void AS $$
DECLARE
    announcement_record RECORD;
    assignment_record RECORD;
BEGIN
    -- Get announcement details
    SELECT * INTO announcement_record 
    FROM public.announcements 
    WHERE id = announcement_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Announcement with id % not found', announcement_id_param;
    END IF;
    
    -- Update announcement status and sent_at
    UPDATE public.announcements 
    SET status = 'active', sent_at = now()
    WHERE id = announcement_id_param;
    
    
    -- Send real-time notifications to all assigned users
    FOR assignment_record IN 
        SELECT aa.user_id, u.email
        FROM public.announcement_assignments aa
        JOIN public.users u ON aa.user_id = u.id
        WHERE aa.announcement_id = announcement_id_param
    LOOP
        -- Send notification via PostgreSQL NOTIFY
        PERFORM pg_notify(
            'announcements',
            jsonb_build_object(
                'type', 'announcement_sent',
                'announcement_id', announcement_id_param,
                'user_id', assignment_record.user_id,
                'title', announcement_record.title,
                'message', announcement_record.message,
                'priority', announcement_record.priority,
                'allow_dismiss', announcement_record.allow_dismiss,
                'created_at', announcement_record.created_at,
                'sent_at', now()
            )::text
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to dismiss announcement for a user
CREATE OR REPLACE FUNCTION dismiss_announcement(
    announcement_id_param int4,
    user_id_param int4,
    dismissal_reason_param varchar(50) DEFAULT 'user_dismissed'
)
RETURNS void AS $$
DECLARE
    announcement_record public.announcements%ROWTYPE;
BEGIN
    -- Get announcement details
    SELECT * INTO announcement_record 
    FROM public.announcements 
    WHERE id = announcement_id_param;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Announcement with id % not found', announcement_id_param;
    END IF;
    
    -- Update assignment dismissed_at
    UPDATE public.announcement_assignments 
    SET dismissed_at = now()
    WHERE announcement_id = announcement_id_param AND user_id = user_id_param;
    
    -- Send real-time notification about dismissal
    PERFORM pg_notify(
        'announcements',
        jsonb_build_object(
            'type', 'announcement_dismissed',
            'announcement_id', announcement_id_param,
            'user_id', user_id_param,
            'dismissed_at', now(),
            'dismissal_reason', dismissal_reason_param
        )::text
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get active announcements for a user
CREATE OR REPLACE FUNCTION get_user_announcements(user_id_param int4)
RETURNS TABLE (
    announcement_id int4,
    title varchar(255),
    message text,
    priority public."announcement_priority_enum",
    status public."announcement_status_enum",
    dismissed_at timestamptz,
    is_dismissed boolean,
    allow_dismiss boolean,
    created_at timestamptz,
    updated_at timestamptz,
    expires_at timestamptz,
    sent_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as announcement_id,
        a.title,
        a.message,
        a.priority,
        a.status,
        aa.dismissed_at,
        aa.dismissed_at IS NOT NULL as is_dismissed,
        a.allow_dismiss,
        a.created_at,
        a.updated_at,
        a.expires_at,
        a.sent_at
    FROM public.announcements a
    JOIN public.announcement_assignments aa ON a.id = aa.announcement_id
    WHERE aa.user_id = user_id_param
        AND a.status IN ('active', 'scheduled')
        AND (a.expires_at IS NULL OR a.expires_at > now())
    ORDER BY a.priority DESC, a.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SCHEDULER FUNCTIONS
-- =====================================================

-- Function to process scheduled announcements
CREATE OR REPLACE FUNCTION process_scheduled_announcements()
RETURNS void AS $$
DECLARE
    announcement_record RECORD;
    assignment_record RECORD;
BEGIN
    -- Find announcements that are scheduled and ready to send
    FOR announcement_record IN 
        SELECT id, title, expires_at
        FROM public.announcements 
        WHERE status = 'scheduled' 
            AND scheduled_at IS NOT NULL 
            AND scheduled_at <= now()
    LOOP
        -- Create assignments if not already created
        PERFORM create_announcement_assignments(announcement_record.id);
        
        -- Send the announcement
        PERFORM send_announcement(announcement_record.id);
        
        RAISE NOTICE 'Processed scheduled announcement: %', announcement_record.title;
    END LOOP;
    
    -- Mark expired announcements and send notifications
    FOR announcement_record IN 
        SELECT id, title, assigned_user_ids
        FROM public.announcements 
        WHERE status = 'active' 
            AND expires_at IS NOT NULL 
            AND expires_at <= now()
    LOOP
        -- Update status to expired
        UPDATE public.announcements 
        SET status = 'expired'
        WHERE id = announcement_record.id;
        
        -- Send notification to all assigned users
        FOR assignment_record IN 
            SELECT unnest(announcement_record.assigned_user_ids) as user_id
        LOOP
            PERFORM pg_notify(
                'announcements',
                jsonb_build_object(
                    'type', 'announcement_expired',
                    'announcement_id', announcement_record.id,
                    'user_id', assignment_record.user_id,
                    'title', announcement_record.title,
                    'expires_at', now()
                )::text
            );
        END LOOP;
        
        RAISE NOTICE 'Marked expired announcement: %', announcement_record.title;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-dismiss expired announcements
CREATE OR REPLACE FUNCTION auto_dismiss_expired_announcements()
RETURNS void AS $$
DECLARE
    announcement_record RECORD;
    assignment_record RECORD;
BEGIN
    -- Find active announcements that have expired
    FOR announcement_record IN 
        SELECT id, title
        FROM public.announcements 
        WHERE status = 'active' 
            AND expires_at IS NOT NULL 
            AND expires_at <= now()
    LOOP
        -- Auto-dismiss for all assigned users
        FOR assignment_record IN 
            SELECT user_id
            FROM public.announcement_assignments 
            WHERE announcement_id = announcement_record.id
                AND dismissed_at IS NULL
        LOOP
            PERFORM dismiss_announcement(
                announcement_record.id, 
                assignment_record.user_id, 
                'auto_expired'
            );
        END LOOP;
        
        -- Update announcement status
        UPDATE public.announcements 
        SET status = 'expired'
        WHERE id = announcement_record.id;
        
        RAISE NOTICE 'Auto-dismissed expired announcement: %', announcement_record.title;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to create a simple announcement
CREATE OR REPLACE FUNCTION create_simple_announcement(
    title_param varchar(255),
    message_param text,
    assigned_user_ids_param _int4,
    created_by_param int4,
    priority_param public."announcement_priority_enum" DEFAULT 'medium'
)
RETURNS int4 AS $$
DECLARE
    announcement_id int4;
BEGIN
    -- Insert announcement
    INSERT INTO public.announcements (
        title, message, assigned_user_ids, 
        priority, created_by, status
    ) VALUES (
        title_param, message_param, assigned_user_ids_param,
        priority_param, created_by_param, 'draft'
    ) RETURNING id INTO announcement_id;
    
    -- Create assignments
    PERFORM create_announcement_assignments(announcement_id);
    
    -- Update status to active and send immediately
    UPDATE public.announcements SET status = 'active', sent_at = now() WHERE id = announcement_id;
    PERFORM send_announcement(announcement_id);
    
    RETURN announcement_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create a scheduled announcement
CREATE OR REPLACE FUNCTION create_scheduled_announcement(
    title_param varchar(255),
    message_param text,
    scheduled_at_param timestamptz,
    created_by_param int4,
    assigned_user_ids_param _int4,
    expires_at_param timestamptz DEFAULT NULL,
    priority_param public."announcement_priority_enum" DEFAULT 'medium'
)
RETURNS int4 AS $$
DECLARE
    announcement_id int4;
BEGIN
    -- Insert announcement
    INSERT INTO public.announcements (
        title, message, scheduled_at, expires_at, assigned_user_ids,
        priority, created_by, status
    ) VALUES (
        title_param, message_param, scheduled_at_param, expires_at_param, 
        assigned_user_ids_param,
        priority_param, created_by_param, 'scheduled'
    ) RETURNING id INTO announcement_id;
    
    -- Create assignments
    PERFORM create_announcement_assignments(announcement_id);
    
    RETURN announcement_id;
END;
$$ LANGUAGE plpgsql;


