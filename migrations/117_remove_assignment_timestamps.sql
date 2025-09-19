-- =====================================================
-- Migration 117: Remove assigned_at and sent_at from announcement_assignments
-- Description: These fields are redundant since we track sent_at in the main announcements table
-- =====================================================

-- Drop the indexes first
DROP INDEX IF EXISTS idx_announcement_assignments_sent_at;

-- Remove the columns from announcement_assignments table
ALTER TABLE public.announcement_assignments 
DROP COLUMN IF EXISTS assigned_at,
DROP COLUMN IF EXISTS sent_at;

-- Update the send_announcement function to remove sent_at updates
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
                'announcement_type', announcement_record.announcement_type,
                'priority', announcement_record.priority,
                'allow_dismiss', announcement_record.allow_dismiss,
                'created_at', announcement_record.created_at,
                'sent_at', now()
            )::text
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the get_user_announcements function to remove assigned_at and sent_at
DROP FUNCTION IF EXISTS get_user_announcements(integer);

CREATE OR REPLACE FUNCTION get_user_announcements(user_id_param int4)
RETURNS TABLE (
    announcement_id int4,
    title varchar,
    message text,
    announcement_type public.announcement_type_enum,
    priority public.announcement_priority_enum,
    status public.announcement_status_enum,
    scheduled_at timestamptz,
    expires_at timestamptz,
    sent_at timestamptz,
    allow_dismiss boolean,
    created_by int4,
    created_at timestamptz,
    updated_at timestamptz,
    dismissed_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as announcement_id,
        a.title,
        a.message,
        a.announcement_type,
        a.priority,
        a.status,
        a.scheduled_at,
        a.expires_at,
        a.sent_at,
        a.allow_dismiss,
        a.created_by,
        a.created_at,
        a.updated_at,
        aa.dismissed_at
    FROM public.announcements a
    JOIN public.announcement_assignments aa ON a.id = aa.announcement_id
    WHERE aa.user_id = user_id_param
        AND a.status = 'active'
        AND (a.expires_at IS NULL OR a.expires_at > now())
        AND aa.dismissed_at IS NULL
    ORDER BY a.priority DESC, a.sent_at DESC;
END;
$$ LANGUAGE plpgsql;
