-- Migration: Drop read_at column from announcement_assignments
-- Since read_at is not used anywhere in the system, we can safely remove it

-- Drop the read_at column
ALTER TABLE public.announcement_assignments
DROP COLUMN IF EXISTS read_at;

-- Drop the index on read_at since the column no longer exists
DROP INDEX IF EXISTS idx_announcement_assignments_read_at;

-- Migration completed: Dropped unused read_at column
