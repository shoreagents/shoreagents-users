-- Migration: Auto-assign task creator as assignee
-- This migration ensures that when a task is created, the creator is automatically assigned to it

BEGIN;

-- Create function to auto-assign task creator
CREATE OR REPLACE FUNCTION auto_assign_task_creator()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert the task creator as an assignee if they're not already assigned
    INSERT INTO task_assignees (task_id, user_id)
    VALUES (NEW.id, NEW.user_id)
    ON CONFLICT (task_id, user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-assign creator when task is created
DROP TRIGGER IF EXISTS trg_auto_assign_task_creator ON tasks;
CREATE TRIGGER trg_auto_assign_task_creator
    AFTER INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION auto_assign_task_creator();

-- Test the trigger by checking existing tasks
SELECT 'Testing auto-assignment trigger...' as status;

-- Show current state
SELECT 'Current task_assignees after trigger creation:' as status;
SELECT ta.task_id, ta.user_id, t.title, t.user_id as creator_id,
       CASE WHEN ta.user_id = t.user_id THEN '(creator)' ELSE '' END as is_creator
FROM task_assignees ta
JOIN tasks t ON t.id = ta.task_id
WHERE t.status = 'active'
ORDER BY ta.task_id, ta.user_id;

COMMIT;
