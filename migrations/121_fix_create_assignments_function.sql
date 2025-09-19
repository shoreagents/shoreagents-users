-- =====================================================
-- Migration 121: Fix create_announcement_assignments function
-- Description: Remove assigned_at reference from the function
-- =====================================================

-- Update the create_announcement_assignments function
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
