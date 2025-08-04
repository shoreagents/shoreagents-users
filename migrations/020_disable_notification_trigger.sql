-- Disable notification trigger to reduce console logging
-- This will stop the database from sending notifications on every update

-- Drop the notification trigger
DROP TRIGGER IF EXISTS notify_activity_data_change ON activity_data;

-- Keep the function but don't use it for now
-- The real-time functionality will still work through Socket.IO 