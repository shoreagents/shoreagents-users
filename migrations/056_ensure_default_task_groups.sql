-- Migration: Ensure default task groups exist
-- This migration creates default task groups if they don't exist

BEGIN;

-- Check if task_groups table exists and has any data
DO $$
BEGIN
    -- Create default task groups if none exist
    IF NOT EXISTS (SELECT 1 FROM task_groups LIMIT 1) THEN
        INSERT INTO task_groups (title, color, position, is_default, created_by)
        VALUES 
            ('To Do', 'bg-gray-200', 0, true, 2),
            ('In Progress', 'bg-blue-100', 1, true, 2),
            ('Review', 'bg-yellow-100', 2, true, 2),
            ('Done', 'bg-green-100', 3, true, 2)
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Default task groups created successfully';
    ELSE
        RAISE NOTICE 'Task groups already exist, skipping creation';
    END IF;
END $$;

-- Show current task groups
SELECT 'Current task groups:' as status;
SELECT id, title, color, position, is_default, created_by FROM task_groups ORDER BY position;

COMMIT;
