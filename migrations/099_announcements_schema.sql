-- =====================================================
-- Announcements Schema Migration
-- Migration: 099_announcements_schema.sql
-- Description: Complete announcement system with scheduling, 
--              real-time notifications, and localStorage tracking
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

-- Create announcement type enum
CREATE TYPE public."announcement_type_enum" AS ENUM (
    'info',
    'warning',
    'success',
    'error',
    'maintenance'
);

-- Create announcements table
CREATE TABLE public.announcements (
    id serial4 NOT NULL,
    title varchar(255) NOT NULL,
    message text NOT NULL,
    description text NULL,
    announcement_type public."announcement_type_enum" DEFAULT 'info'::announcement_type_enum NOT NULL,
    priority public."announcement_priority_enum" DEFAULT 'medium'::announcement_priority_enum NOT NULL,
    status public."announcement_status_enum" DEFAULT 'draft'::announcement_status_enum NOT NULL,
    
    -- Scheduling fields
    scheduled_at timestamptz NULL,
    expires_at timestamptz NULL,
    sent_at timestamptz NULL,
    
    -- Targeting fields
    target_user_type public."user_type_enum" NULL, -- Target specific user types
    target_role_ids _int4 NULL, -- Target specific roles
    target_user_ids _int4 NULL, -- Target specific users
    
    -- Display settings
    show_duration_seconds int4 DEFAULT 0 NULL, -- 0 = until manually closed
    auto_close boolean DEFAULT false NULL,
    allow_dismiss boolean DEFAULT true NULL,
    show_icon boolean DEFAULT true NULL,
    icon_name varchar(50) DEFAULT 'Bell'::character varying NULL,
    
    -- Styling
    background_color varchar(7) DEFAULT '#3b82f6'::character varying NULL, -- Hex color
    text_color varchar(7) DEFAULT '#ffffff'::character varying NULL,
    border_color varchar(7) DEFAULT '#1d4ed8'::character varying NULL,
    
    -- Action settings
    action_url text NULL,
    action_text varchar(50) NULL,
    action_type varchar(20) DEFAULT 'link'::character varying NULL, -- 'link', 'button', 'none'
    
    -- Metadata
    created_by int4 NOT NULL,
    created_at timestamptz DEFAULT now() NULL,
    updated_at timestamptz DEFAULT now() NULL,
    
    -- Constraints
    CONSTRAINT announcements_pkey PRIMARY KEY (id),
    CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT announcements_scheduled_at_check CHECK (scheduled_at IS NULL OR scheduled_at > created_at),
    CONSTRAINT announcements_expires_at_check CHECK (expires_at IS NULL OR expires_at > scheduled_at),
    CONSTRAINT announcements_show_duration_check CHECK (show_duration_seconds >= 0),
    CONSTRAINT announcements_action_type_check CHECK (action_type IN ('link', 'button', 'none')),
    CONSTRAINT announcements_target_check CHECK (
        (target_user_type IS NOT NULL) OR 
        (target_role_ids IS NOT NULL AND array_length(target_role_ids, 1) > 0) OR 
        (target_user_ids IS NOT NULL AND array_length(target_user_ids, 1) > 0)
    )
);

-- Create announcement_assignments table for detailed user targeting
CREATE TABLE public.announcement_assignments (
    id serial4 NOT NULL,
    announcement_id int4 NOT NULL,
    user_id int4 NOT NULL,
    assigned_at timestamptz DEFAULT now() NULL,
    sent_at timestamptz NULL,
    read_at timestamptz NULL,
    dismissed_at timestamptz NULL,
    
    CONSTRAINT announcement_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT announcement_assignments_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE,
    CONSTRAINT announcement_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT announcement_assignments_unique UNIQUE (announcement_id, user_id)
);

-- Create announcement_dismissals table for localStorage tracking
CREATE TABLE public.announcement_dismissals (
    id serial4 NOT NULL,
    announcement_id int4 NOT NULL,
    user_id int4 NOT NULL,
    dismissed_at timestamptz DEFAULT now() NULL,
    dismissal_reason varchar(50) DEFAULT 'user_dismissed'::character varying NULL, -- 'user_dismissed', 'auto_expired', 'auto_closed'
    client_info jsonb NULL, -- Store browser/client info for analytics
    
    CONSTRAINT announcement_dismissals_pkey PRIMARY KEY (id),
    CONSTRAINT announcement_dismissals_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE,
    CONSTRAINT announcement_dismissals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT announcement_dismissals_unique UNIQUE (announcement_id, user_id),
    CONSTRAINT announcement_dismissals_reason_check CHECK (dismissal_reason IN ('user_dismissed', 'auto_expired', 'auto_closed'))
);

-- Create indexes for performance
CREATE INDEX idx_announcements_status ON public.announcements USING btree (status);
CREATE INDEX idx_announcements_scheduled_at ON public.announcements USING btree (scheduled_at);
CREATE INDEX idx_announcements_expires_at ON public.announcements USING btree (expires_at);
CREATE INDEX idx_announcements_created_by ON public.announcements USING btree (created_by);
CREATE INDEX idx_announcements_target_user_type ON public.announcements USING btree (target_user_type);
CREATE INDEX idx_announcements_target_role_ids ON public.announcements USING gin (target_role_ids);
CREATE INDEX idx_announcements_target_user_ids ON public.announcements USING gin (target_user_ids);
CREATE INDEX idx_announcements_status_scheduled ON public.announcements USING btree (status, scheduled_at);

CREATE INDEX idx_announcement_assignments_announcement_id ON public.announcement_assignments USING btree (announcement_id);
CREATE INDEX idx_announcement_assignments_user_id ON public.announcement_assignments USING btree (user_id);
CREATE INDEX idx_announcement_assignments_sent_at ON public.announcement_assignments USING btree (sent_at);
CREATE INDEX idx_announcement_assignments_read_at ON public.announcement_assignments USING btree (read_at);

CREATE INDEX idx_announcement_dismissals_announcement_id ON public.announcement_dismissals USING btree (announcement_id);
CREATE INDEX idx_announcement_dismissals_user_id ON public.announcement_dismissals USING btree (user_id);
CREATE INDEX idx_announcement_dismissals_dismissed_at ON public.announcement_dismissals USING btree (dismissed_at);

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

-- =====================================================
-- ANNOUNCEMENT MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to create announcement assignments based on targeting rules
CREATE OR REPLACE FUNCTION create_announcement_assignments(announcement_id_param int4)
RETURNS void AS $$
DECLARE
    announcement_record public.announcements%ROWTYPE;
    target_users int4[];
    user_record RECORD;
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
    
    -- Build target user list based on targeting rules
    target_users := ARRAY[]::int4[];
    
    -- Add users by user type
    IF announcement_record.target_user_type IS NOT NULL THEN
        FOR user_record IN 
            SELECT id FROM public.users 
            WHERE user_type = announcement_record.target_user_type
        LOOP
            target_users := array_append(target_users, user_record.id);
        END LOOP;
    END IF;
    
    -- Add users by role
    IF announcement_record.target_role_ids IS NOT NULL THEN
        FOR user_record IN 
            SELECT DISTINCT u.id 
            FROM public.users u
            JOIN public.user_roles ur ON u.id = ur.user_id
            WHERE ur.role_id = ANY(announcement_record.target_role_ids)
        LOOP
            target_users := array_append(target_users, user_record.id);
        END LOOP;
    END IF;
    
    -- Add specific users
    IF announcement_record.target_user_ids IS NOT NULL THEN
        target_users := target_users || announcement_record.target_user_ids;
    END IF;
    
    -- Remove duplicates
    target_users := ARRAY(SELECT DISTINCT unnest(target_users));
    
    -- Create assignments
    IF array_length(target_users, 1) > 0 THEN
        INSERT INTO public.announcement_assignments (announcement_id, user_id)
        SELECT announcement_id_param, unnest(target_users);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to send announcement to assigned users
CREATE OR REPLACE FUNCTION send_announcement(announcement_id_param int4)
RETURNS void AS $$
DECLARE
    announcement_record public.announcements%ROWTYPE;
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
    
    -- Update assignment sent_at timestamps
    UPDATE public.announcement_assignments 
    SET sent_at = now()
    WHERE announcement_id = announcement_id_param;
    
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
            json_build_object(
                'type', 'announcement_sent',
                'announcement_id', announcement_id_param,
                'user_id', assignment_record.user_id,
                'title', announcement_record.title,
                'message', announcement_record.message,
                'announcement_type', announcement_record.announcement_type,
                'priority', announcement_record.priority,
                'action_url', announcement_record.action_url,
                'action_text', announcement_record.action_text,
                'background_color', announcement_record.background_color,
                'text_color', announcement_record.text_color,
                'border_color', announcement_record.border_color,
                'show_duration_seconds', announcement_record.show_duration_seconds,
                'auto_close', announcement_record.auto_close,
                'allow_dismiss', announcement_record.allow_dismiss,
                'show_icon', announcement_record.show_icon,
                'icon_name', announcement_record.icon_name,
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
    
    -- Record dismissal
    INSERT INTO public.announcement_dismissals (announcement_id, user_id, dismissal_reason)
    VALUES (announcement_id_param, user_id_param, dismissal_reason_param)
    ON CONFLICT (announcement_id, user_id) DO NOTHING;
    
    -- Update assignment dismissed_at
    UPDATE public.announcement_assignments 
    SET dismissed_at = now()
    WHERE announcement_id = announcement_id_param AND user_id = user_id_param;
    
    -- Send real-time notification about dismissal
    PERFORM pg_notify(
        'announcements',
        json_build_object(
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
    description text,
    announcement_type public."announcement_type_enum",
    priority public."announcement_priority_enum",
    action_url text,
    action_text varchar(50),
    background_color varchar(7),
    text_color varchar(7),
    border_color varchar(7),
    show_duration_seconds int4,
    auto_close boolean,
    allow_dismiss boolean,
    show_icon boolean,
    icon_name varchar(50),
    created_at timestamptz,
    sent_at timestamptz,
    is_dismissed boolean,
    dismissed_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as announcement_id,
        a.title,
        a.message,
        a.description,
        a.announcement_type,
        a.priority,
        a.action_url,
        a.action_text,
        a.background_color,
        a.text_color,
        a.border_color,
        a.show_duration_seconds,
        a.auto_close,
        a.allow_dismiss,
        a.show_icon,
        a.icon_name,
        a.created_at,
        a.sent_at,
        (ad.dismissed_at IS NOT NULL) as is_dismissed,
        ad.dismissed_at
    FROM public.announcements a
    JOIN public.announcement_assignments aa ON a.id = aa.announcement_id
    LEFT JOIN public.announcement_dismissals ad ON a.id = ad.announcement_id AND ad.user_id = user_id_param
    WHERE aa.user_id = user_id_param
        AND a.status = 'active'
        AND (a.expires_at IS NULL OR a.expires_at > now())
        AND ad.dismissed_at IS NULL
    ORDER BY a.priority DESC, a.sent_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ANNOUNCEMENT SCHEDULER FUNCTIONS
-- =====================================================

-- Function to process scheduled announcements
CREATE OR REPLACE FUNCTION process_scheduled_announcements()
RETURNS void AS $$
DECLARE
    announcement_record RECORD;
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
    
    -- Mark expired announcements
    UPDATE public.announcements 
    SET status = 'expired'
    WHERE status = 'active' 
        AND expires_at IS NOT NULL 
        AND expires_at <= now();
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
-- REAL-TIME NOTIFICATION TRIGGERS
-- =====================================================

-- Function to notify about announcement changes
CREATE OR REPLACE FUNCTION notify_announcement_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_payload jsonb;
BEGIN
    -- Build notification payload
    notification_payload := json_build_object(
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
        notification_payload := notification_payload || json_build_object(
            'message', NEW.message,
            'announcement_type', NEW.announcement_type,
            'priority', NEW.priority,
            'scheduled_at', NEW.scheduled_at
        );
    ELSIF TG_OP = 'UPDATE' THEN
        notification_payload := notification_payload || json_build_object(
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
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to create a simple announcement
CREATE OR REPLACE FUNCTION create_simple_announcement(
    title_param varchar(255),
    message_param text,
    target_user_type_param public."user_type_enum" DEFAULT NULL,
    target_user_ids_param _int4 DEFAULT NULL,
    priority_param public."announcement_priority_enum" DEFAULT 'medium',
    announcement_type_param public."announcement_type_enum" DEFAULT 'info',
    created_by_param int4
)
RETURNS int4 AS $$
DECLARE
    announcement_id int4;
BEGIN
    -- Insert announcement
    INSERT INTO public.announcements (
        title, message, target_user_type, target_user_ids, 
        priority, announcement_type, created_by, status
    ) VALUES (
        title_param, message_param, target_user_type_param, target_user_ids_param,
        priority_param, announcement_type_param, created_by_param, 'draft'
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
    expires_at_param timestamptz DEFAULT NULL,
    target_user_type_param public."user_type_enum" DEFAULT NULL,
    target_user_ids_param _int4 DEFAULT NULL,
    priority_param public."announcement_priority_enum" DEFAULT 'medium',
    announcement_type_param public."announcement_type_enum" DEFAULT 'info',
    created_by_param int4
)
RETURNS int4 AS $$
DECLARE
    announcement_id int4;
BEGIN
    -- Insert announcement
    INSERT INTO public.announcements (
        title, message, scheduled_at, expires_at, target_user_type, target_user_ids,
        priority, announcement_type, created_by, status
    ) VALUES (
        title_param, message_param, scheduled_at_param, expires_at_param, 
        target_user_type_param, target_user_ids_param,
        priority_param, announcement_type_param, created_by_param, 'scheduled'
    ) RETURNING id INTO announcement_id;
    
    -- Create assignments
    PERFORM create_announcement_assignments(announcement_id);
    
    RETURN announcement_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.announcements IS 'Stores announcement data with scheduling and targeting capabilities';
COMMENT ON TABLE public.announcement_assignments IS 'Tracks which users are assigned to receive specific announcements';
COMMENT ON TABLE public.announcement_dismissals IS 'Tracks when users dismiss announcements for localStorage persistence';

COMMENT ON COLUMN public.announcements.show_duration_seconds IS 'How long to show announcement (0 = until manually closed)';
COMMENT ON COLUMN public.announcements.auto_close IS 'Whether to automatically close after show_duration_seconds';
COMMENT ON COLUMN public.announcements.allow_dismiss IS 'Whether users can manually dismiss the announcement';
COMMENT ON COLUMN public.announcements.action_type IS 'Type of action: link, button, or none';

COMMENT ON FUNCTION create_announcement_assignments IS 'Creates user assignments based on announcement targeting rules';
COMMENT ON FUNCTION send_announcement IS 'Sends announcement to all assigned users with real-time notifications';
COMMENT ON FUNCTION dismiss_announcement IS 'Records user dismissal of an announcement';
COMMENT ON FUNCTION get_user_announcements IS 'Retrieves active announcements for a specific user';
COMMENT ON FUNCTION process_scheduled_announcements IS 'Processes announcements that are ready to be sent';
COMMENT ON FUNCTION auto_dismiss_expired_announcements IS 'Automatically dismisses expired announcements';
COMMENT ON FUNCTION create_simple_announcement IS 'Creates and immediately sends a simple announcement';
COMMENT ON FUNCTION create_scheduled_announcement IS 'Creates a scheduled announcement for future delivery';
