-- Fix duplicate task positions
-- This migration will normalize task positions within each group

DO $$
DECLARE
    group_record RECORD;
    task_record RECORD;
    new_position INTEGER;
BEGIN
    -- Loop through each group
    FOR group_record IN 
        SELECT DISTINCT group_id 
        FROM tasks 
        WHERE status = 'active'
        ORDER BY group_id
    LOOP
        new_position := 1;
        
        -- Update positions for tasks in this group
        FOR task_record IN 
            SELECT id 
            FROM tasks 
            WHERE group_id = group_record.group_id 
            AND status = 'active'
            ORDER BY position, created_at
        LOOP
            UPDATE tasks 
            SET position = new_position,
                updated_at = NOW() AT TIME ZONE 'Asia/Manila'
            WHERE id = task_record.id;
            
            new_position := new_position + 1;
        END LOOP;
    END LOOP;
END $$;

-- Add a unique constraint to prevent future duplicates
-- (This will be added after the positions are fixed)
-- Temporarily commented out to avoid constraint violations during development
-- ALTER TABLE tasks 
-- ADD CONSTRAINT unique_task_position_per_group 
-- UNIQUE (group_id, position, status); 