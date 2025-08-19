-- OPTIONAL: Expand relationship types (only if you need more than "related_to")
-- This is NOT required - your current DDL is fine!

BEGIN;

-- Remove the restrictive constraint
ALTER TABLE task_relations DROP CONSTRAINT IF EXISTS task_relations_type_check;

-- Add a more flexible constraint that allows common relationship types
ALTER TABLE task_relations ADD CONSTRAINT task_relations_type_check 
CHECK (type IN ('related_to', 'blocks', 'depends_on', 'duplicates', 'subtask_of'));

-- Or even simpler: just remove the constraint entirely for maximum flexibility
-- ALTER TABLE task_relations DROP CONSTRAINT IF EXISTS task_relations_type_check;

COMMIT;

-- Note: This is OPTIONAL. Your current DDL works perfectly for basic relationships!
