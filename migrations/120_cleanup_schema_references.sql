-- =====================================================
-- Migration 120: Clean up remaining schema references
-- Description: Remove remaining references to announcement_type and assigned_at/sent_at
-- =====================================================

-- Update the main schema file functions that still reference announcement_type
-- First, let's update the create_announcement function
CREATE OR REPLACE FUNCTION create_announcement(
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

-- Update the create_scheduled_announcement function
CREATE OR REPLACE FUNCTION create_scheduled_announcement(
    title_param varchar(255),
    message_param text,
    assigned_user_ids_param _int4,
    scheduled_at_param timestamptz,
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
        priority, created_by, status, scheduled_at
    ) VALUES (
        title_param, message_param, assigned_user_ids_param,
        priority_param, created_by_param, 'scheduled', scheduled_at_param
    ) RETURNING id INTO announcement_id;
    
    -- Create assignments
    PERFORM create_announcement_assignments(announcement_id);
    
    RETURN announcement_id;
END;
$$ LANGUAGE plpgsql;
