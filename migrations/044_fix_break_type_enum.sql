-- Migration to fix break type enum values
-- This resolves conflicts with the word 'Midnight' used in other contexts

-- First, update existing break_sessions data to use new enum values
UPDATE break_sessions 
SET break_type = 'NightFirst'::break_type_enum 
WHERE break_type = 'FirstNight'::break_type_enum;

UPDATE break_sessions 
SET break_type = 'NightMeal'::break_type_enum 
WHERE break_type = 'Midnight'::break_type_enum;

UPDATE break_sessions 
SET break_type = 'NightSecond'::break_type_enum 
WHERE break_type = 'SecondNight'::break_type_enum;

-- Drop the old enum type
DROP TYPE IF EXISTS break_type_enum CASCADE;

-- Recreate the enum with new values
CREATE TYPE break_type_enum AS ENUM (
    'Morning',
    'Lunch', 
    'Afternoon',
    'NightFirst',
    'NightMeal',
    'NightSecond'
);

-- Update the break_sessions table to use the new enum
ALTER TABLE break_sessions 
ALTER COLUMN break_type TYPE break_type_enum 
USING break_type::text::break_type_enum;

-- Add back the constraint
ALTER TABLE break_sessions 
ADD CONSTRAINT break_sessions_break_type_check 
CHECK (break_type IN ('Morning', 'Lunch', 'Afternoon', 'NightFirst', 'NightMeal', 'NightSecond'));

-- Recreate indexes if needed
CREATE INDEX IF NOT EXISTS idx_break_sessions_break_type ON break_sessions(break_type);

-- Verify the changes
SELECT DISTINCT break_type FROM break_sessions ORDER BY break_type;
