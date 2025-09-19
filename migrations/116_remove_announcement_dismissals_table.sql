-- Migration: Remove announcement_dismissals table
-- Since dismissals are already tracked in announcement_assignments.dismissed_at,
-- the separate dismissals table is redundant and adds unnecessary complexity

-- Drop the announcement_dismissals table and its constraints
DROP TABLE IF EXISTS public.announcement_dismissals CASCADE;

-- Update the dismiss_announcement function to only update assignments
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

-- Migration completed: Removed redundant announcement_dismissals table
