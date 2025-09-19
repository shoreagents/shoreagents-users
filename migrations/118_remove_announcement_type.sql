-- =====================================================
-- Migration 118: Remove announcement_type enum and column
-- Description: Remove announcement_type as it's not needed for the agent dashboard
-- =====================================================

-- Drop functions that depend on the enum first
DROP FUNCTION IF EXISTS get_user_announcements(integer);

-- Drop the announcement_type column from announcements table
ALTER TABLE public.announcements 
DROP COLUMN IF EXISTS announcement_type;

-- Drop the announcement_type_enum type
DROP TYPE IF EXISTS public."announcement_type_enum";

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

-- Update the send_announcement function to remove announcement_type
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
                'priority', announcement_record.priority,
                'allow_dismiss', announcement_record.allow_dismiss,
                'created_at', announcement_record.created_at,
                'sent_at', now()
            )::text
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;
