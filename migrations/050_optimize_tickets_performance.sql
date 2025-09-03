-- Migration: Optimize tickets performance with better indexes
-- This migration adds composite indexes for common query patterns

-- Add composite index for user_id + created_at (most common query pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_user_created 
ON tickets(user_id, created_at DESC);

-- Add composite index for user_id + status (filtering by status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_user_status 
ON tickets(user_id, status);

-- Add composite index for user_id + position (ordering by position)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_user_position 
ON tickets(user_id, position ASC);

-- Add composite index for category_id + created_at (category filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_category_created 
ON tickets(category_id, created_at DESC);

-- Add index for ticket_id lookups (already exists but ensure it's there)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_ticket_id_lookup 
ON tickets(ticket_id);

-- Add index for file_count (for filtering tickets with files)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_file_count 
ON tickets(file_count) WHERE file_count > 0;

-- Add partial index for active tickets (not closed/resolved)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_active 
ON tickets(user_id, created_at DESC) 
WHERE status NOT IN ('Closed', 'Resolved', 'Completed');

-- Add index for ticket_categories name lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ticket_categories_name 
ON ticket_categories(name);

-- Add index for users email lookups (if not exists)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
ON users(email);

-- Update table statistics for better query planning
ANALYZE tickets;
ANALYZE ticket_categories;
ANALYZE users;

-- Add comments for documentation
COMMENT ON INDEX idx_tickets_user_created IS 'Composite index for user tickets ordered by creation date';
COMMENT ON INDEX idx_tickets_user_status IS 'Composite index for filtering user tickets by status';
COMMENT ON INDEX idx_tickets_user_position IS 'Composite index for ordering user tickets by position';
COMMENT ON INDEX idx_tickets_category_created IS 'Composite index for category-based ticket queries';
COMMENT ON INDEX idx_tickets_active IS 'Partial index for active (non-closed) tickets';
