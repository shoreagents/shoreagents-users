-- =====================================================
-- Announcements Usage Examples
-- Migration: 100_announcements_usage_examples.sql
-- Description: Examples and sample data for announcement system
-- =====================================================

-- =====================================================
-- SAMPLE ANNOUNCEMENTS
-- =====================================================

-- Example 1: Immediate info announcement to all agents
SELECT create_simple_announcement(
    'Welcome to the New Dashboard!',
    'We have updated the dashboard with new features. Check out the productivity section for enhanced task tracking.',
    'Agent'::user_type_enum,
    NULL,
    'medium'::announcement_priority_enum,
    'info'::announcement_type_enum,
    1 -- created_by user_id
);

-- Example 2: Urgent maintenance announcement to all users
SELECT create_simple_announcement(
    'Scheduled Maintenance Tonight',
    'The system will be under maintenance from 11 PM to 1 AM. Please save your work.',
    NULL,
    NULL,
    'urgent'::announcement_priority_enum,
    'warning'::announcement_type_enum,
    1 -- created_by user_id
);

-- Example 3: Scheduled announcement for tomorrow
SELECT create_scheduled_announcement(
    'Weekly Team Meeting Reminder',
    'Don''t forget about our weekly team meeting tomorrow at 2 PM in the conference room.',
    now() + interval '1 day',
    now() + interval '2 days',
    'Agent'::user_type_enum,
    NULL,
    'medium'::announcement_priority_enum,
    'info'::announcement_type_enum,
    1 -- created_by user_id
);

-- Example 4: Custom styled announcement with action
INSERT INTO public.announcements (
    title, message, description, announcement_type, priority, status,
    target_user_type, action_url, action_text, action_type,
    background_color, text_color, border_color,
    show_duration_seconds, auto_close, allow_dismiss, show_icon, icon_name,
    created_by
) VALUES (
    'New Feature: Advanced Reporting',
    'Check out our new advanced reporting features that provide deeper insights into your productivity.',
    'The new reporting system includes detailed analytics, custom date ranges, and export capabilities.',
    'success'::announcement_type_enum,
    'high'::announcement_priority_enum,
    'draft'::announcement_status_enum,
    'Agent'::user_type_enum,
    '/dashboard/reports',
    'View Reports',
    'button'::varchar(20),
    '#10b981'::varchar(7), -- green
    '#ffffff'::varchar(7),
    '#059669'::varchar(7), -- darker green
    0, -- show until dismissed
    false,
    true,
    true,
    'BarChart3',
    1
);

-- Create assignments for the custom announcement
SELECT create_announcement_assignments(LASTVAL());

-- Send the custom announcement
SELECT send_announcement(LASTVAL());

-- =====================================================
-- USAGE SCENARIOS
-- =====================================================

-- Scenario 1: System maintenance notification
-- This would typically be called by an admin user
DO $$
DECLARE
    announcement_id int4;
BEGIN
    -- Create maintenance announcement
    announcement_id := create_simple_announcement(
        'System Maintenance in 30 Minutes',
        'We will be performing scheduled maintenance. Please save your work and log out.',
        'Agent'::user_type_enum,
        NULL,
        'urgent'::announcement_priority_enum,
        'warning'::announcement_type_enum,
        1 -- admin user_id
    );
    
    RAISE NOTICE 'Created maintenance announcement with ID: %', announcement_id;
END;
$$;

-- Scenario 2: Feature announcement with custom styling
DO $$
DECLARE
    announcement_id int4;
BEGIN
    -- Insert custom announcement
    INSERT INTO public.announcements (
        title, message, announcement_type, priority, status,
        target_user_type, action_url, action_text, action_type,
        background_color, text_color, border_color,
        show_duration_seconds, auto_close, allow_dismiss, show_icon, icon_name,
        created_by
    ) VALUES (
        'New Task Management Features',
        'We''ve added new task management features including bulk operations and improved filtering.',
        'success'::announcement_type_enum,
        'medium'::announcement_priority_enum,
        'draft'::announcement_status_enum,
        'Agent'::user_type_enum,
        '/productivity/tasks',
        'Try New Features',
        'button'::varchar(20),
        '#3b82f6'::varchar(7), -- blue
        '#ffffff'::varchar(7),
        '#1d4ed8'::varchar(7), -- darker blue
        300, -- show for 5 minutes
        true,
        true,
        true,
        'CheckSquare',
        1
    ) RETURNING id INTO announcement_id;
    
    -- Create assignments and send
    PERFORM create_announcement_assignments(announcement_id);
    PERFORM send_announcement(announcement_id);
    
    RAISE NOTICE 'Created feature announcement with ID: %', announcement_id;
END;
$$;

-- Scenario 3: Targeted announcement to specific users
DO $$
DECLARE
    announcement_id int4;
    target_users int4[];
BEGIN
    -- Get some user IDs (assuming users exist)
    SELECT ARRAY_AGG(id) INTO target_users 
    FROM public.users 
    WHERE user_type = 'Agent' 
    LIMIT 5;
    
    IF array_length(target_users, 1) > 0 THEN
        -- Create targeted announcement
        announcement_id := create_simple_announcement(
            'Personal Performance Review',
            'Your quarterly performance review is scheduled. Please prepare your self-assessment.',
            NULL,
            target_users,
            'high'::announcement_priority_enum,
            'info'::announcement_type_enum,
            1 -- admin user_id
        );
        
        RAISE NOTICE 'Created targeted announcement with ID: % for % users', announcement_id, array_length(target_users, 1);
    END IF;
END;
$$;

-- =====================================================
-- QUERY EXAMPLES
-- =====================================================

-- Get all active announcements for a specific user
-- SELECT * FROM get_user_announcements(1);

-- Get announcement statistics
-- SELECT 
--     status,
--     COUNT(*) as count,
--     COUNT(CASE WHEN sent_at IS NOT NULL THEN 1 END) as sent_count
-- FROM public.announcements 
-- GROUP BY status;

-- Get user dismissal statistics
-- SELECT 
--     a.title,
--     COUNT(ad.id) as dismissal_count,
--     COUNT(aa.id) as assignment_count,
--     ROUND(COUNT(ad.id)::numeric / COUNT(aa.id)::numeric * 100, 2) as dismissal_rate
-- FROM public.announcements a
-- LEFT JOIN public.announcement_assignments aa ON a.id = aa.announcement_id
-- LEFT JOIN public.announcement_dismissals ad ON a.id = ad.announcement_id
-- WHERE a.status = 'active'
-- GROUP BY a.id, a.title
-- ORDER BY dismissal_rate DESC;

-- Get announcements by priority and type
-- SELECT 
--     priority,
--     announcement_type,
--     COUNT(*) as count
-- FROM public.announcements 
-- WHERE status = 'active'
-- GROUP BY priority, announcement_type
-- ORDER BY priority DESC, announcement_type;

-- =====================================================
-- MAINTENANCE QUERIES
-- =====================================================

-- Process scheduled announcements (typically run by cron job)
-- SELECT process_scheduled_announcements();

-- Auto-dismiss expired announcements
-- SELECT auto_dismiss_expired_announcements();

-- Clean up old dismissed announcements (older than 30 days)
-- DELETE FROM public.announcement_dismissals 
-- WHERE dismissed_at < now() - interval '30 days';

-- Clean up old expired announcements (older than 90 days)
-- DELETE FROM public.announcements 
-- WHERE status = 'expired' 
-- AND updated_at < now() - interval '90 days';

-- =====================================================
-- TESTING QUERIES
-- =====================================================

-- Test announcement creation and sending
DO $$
DECLARE
    test_announcement_id int4;
    user_announcements RECORD;
BEGIN
    -- Create a test announcement
    test_announcement_id := create_simple_announcement(
        'Test Announcement',
        'This is a test announcement to verify the system is working correctly.',
        'Agent'::user_type_enum,
        NULL,
        'low'::announcement_priority_enum,
        'info'::announcement_type_enum,
        1
    );
    
    RAISE NOTICE 'Created test announcement with ID: %', test_announcement_id;
    
    -- Check if it was assigned to users
    SELECT COUNT(*) INTO user_announcements
    FROM get_user_announcements(1);
    
    RAISE NOTICE 'User 1 has % active announcements', user_announcements;
    
    -- Test dismissal
    PERFORM dismiss_announcement(test_announcement_id, 1, 'user_dismissed');
    RAISE NOTICE 'Dismissed test announcement for user 1';
    
    -- Check announcements again
    SELECT COUNT(*) INTO user_announcements
    FROM get_user_announcements(1);
    
    RAISE NOTICE 'User 1 now has % active announcements (should be 0)', user_announcements;
END;
$$;
