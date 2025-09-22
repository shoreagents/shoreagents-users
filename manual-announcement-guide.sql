-- =====================================================
-- Manual Announcement Creation Guide
-- =====================================================

-- Method 1: Using the create_simple_announcement function (RECOMMENDED)
-- This automatically creates assignments and sends the announcement
SELECT create_simple_announcement(
    'Your Title Here',                    -- title (varchar)
    'Your message content here',          -- message (text)
    ARRAY[1, 2, 3],                      -- assigned_user_ids (integer[])
    1,                                   -- created_by (integer)
    'high'::announcement_priority_enum   -- priority (optional, defaults to 'medium')
);

-- Method 2: Manual insertion (NOT RECOMMENDED - use Method 1 instead)
-- This requires additional steps to create assignments and send
INSERT INTO announcements (
    title, 
    message, 
    priority, 
    status,
    assigned_user_ids, 
    allow_dismiss, 
    created_by
) VALUES (
    'Manual Announcement',
    'This is a manually created announcement',
    'medium'::announcement_priority_enum,
    'draft'::announcement_status_enum,
    ARRAY[1, 2, 3],
    true,
    1
);

-- If using Method 2, you also need to:
-- 1. Create assignments
-- SELECT create_announcement_assignments(LASTVAL());
-- 2. Send the announcement
-- SELECT send_announcement(LASTVAL());

-- =====================================================
-- Priority Options
-- =====================================================
-- 'low'::announcement_priority_enum
-- 'medium'::announcement_priority_enum (default)
-- 'high'::announcement_priority_enum
-- 'urgent'::announcement_priority_enum

-- =====================================================
-- Status Options
-- =====================================================
-- 'draft'::announcement_status_enum
-- 'scheduled'::announcement_status_enum
-- 'active'::announcement_status_enum
-- 'expired'::announcement_status_enum
-- 'cancelled'::announcement_status_enum

-- =====================================================
-- Example: Create an urgent announcement for all users
-- =====================================================
-- First, get all user IDs
-- SELECT id FROM users ORDER BY id;

-- Then create the announcement (replace with actual user IDs)
-- SELECT create_simple_announcement(
--     'URGENT: System Update Required',
--     'Please update your browser to the latest version immediately.',
--     ARRAY[1, 2, 3, 4, 5],  -- Replace with actual user IDs
--     1,                      -- Admin user ID
--     'urgent'::announcement_priority_enum
-- );

-- =====================================================
-- Check existing announcements
-- =====================================================
-- SELECT 
--     id,
--     title,
--     message,
--     priority,
--     status,
--     assigned_user_ids,
--     allow_dismiss,
--     created_at,
--     sent_at
-- FROM announcements 
-- ORDER BY created_at DESC;
