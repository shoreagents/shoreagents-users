-- Migration: Make task groups global/shared instead of per-user
-- This removes the user_id constraint from task_groups and updates related logic

BEGIN;

-- 1. First, let's see what we're working with
SELECT 'Current task groups before migration:' as status;
SELECT id, title, user_id, is_default FROM task_groups ORDER BY id;

-- 2. Remove the user_id column from task_groups to make them global
-- Note: This will make all existing groups global
ALTER TABLE task_groups DROP COLUMN IF EXISTS user_id;

-- 3. Add a created_by column instead to track who originally created the group (optional)
ALTER TABLE task_groups ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- 4. Update the created_by field with the original user_id values (if the column was just added)
-- We'll set all existing groups to be created by user 2 (Kyle) since that's who owns them currently
UPDATE task_groups SET created_by = 2 WHERE created_by IS NULL;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_groups_created_by ON task_groups(created_by);

-- 6. Show the result
SELECT 'Task groups after migration:' as status;
SELECT id, title, created_by, is_default FROM task_groups ORDER BY id;

-- 7. Verify tasks can now be seen across users
SELECT 'Tasks and their groups:' as status;
SELECT t.id, t.title, t.user_id as task_creator, t.group_id, tg.title as group_title, tg.created_by as group_creator
FROM tasks t 
LEFT JOIN task_groups tg ON tg.id = t.group_id 
WHERE t.status = 'active'
ORDER BY t.group_id, t.id;

COMMIT;

-- Note: After this migration, you'll need to update the API code to remove
-- the WHERE tg.user_id = $1 constraint (which we already did)
