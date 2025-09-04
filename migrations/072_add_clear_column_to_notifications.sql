-- Migration 072: Add clear column to notifications table for soft deletion
-- This allows notifications to be hidden from users instead of permanently deleted

-- Add clear column to notifications table
ALTER TABLE notifications 
ADD COLUMN clear BOOLEAN DEFAULT false;

-- Add index for better performance when filtering by clear status
CREATE INDEX idx_notifications_clear ON notifications(clear);

-- Add comment to document the purpose of the clear column
COMMENT ON COLUMN notifications.clear IS 'When true, notification is hidden from users (soft deleted)';

-- Update the existing notifications to ensure they are not cleared by default
UPDATE notifications SET clear = false WHERE clear IS NULL;
