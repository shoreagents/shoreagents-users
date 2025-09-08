-- Migration 077: Add event type field to distinguish between Event and Activity
-- This migration adds a type field to the events table

-- Add type column to events table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'event_type') THEN
        ALTER TABLE events 
        ADD COLUMN event_type VARCHAR(20) DEFAULT 'event' CHECK (event_type IN ('event', 'activity'));
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN events.event_type IS 'Type of event: event or activity';

-- Create index for better performance on event type queries
CREATE INDEX IF NOT EXISTS idx_events_type_status ON events(event_type, status);

-- Update existing events to have 'event' type (default value)
UPDATE events SET event_type = 'event' WHERE event_type IS NULL;

-- Make the column NOT NULL after setting default values
ALTER TABLE events ALTER COLUMN event_type SET NOT NULL;
