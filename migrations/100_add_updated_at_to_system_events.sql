-- Add updated_at column to system_events table
-- Migration: 100_add_updated_at_to_system_events.sql
-- Description: Adds updated_at column to track when system events are modified

-- Add updated_at column if it doesn't exist
ALTER TABLE system_events 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to set updated_at to created_at
UPDATE system_events 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Create trigger to automatically update updated_at on row updates
DROP TRIGGER IF EXISTS update_system_events_updated_at ON system_events;
CREATE TRIGGER update_system_events_updated_at
    BEFORE UPDATE ON system_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON COLUMN system_events.updated_at IS 'Timestamp when the system event was last updated';
