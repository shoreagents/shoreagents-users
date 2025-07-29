-- Fix Database Timezone to Local Time (UTC+8)
-- Generated for your timezone offset

-- Set database timezone (choose one that matches your location):
-- SET timezone = 'Asia/Manila';
-- SET timezone = 'Asia/Singapore';
-- SET timezone = 'Asia/Shanghai';
-- SET timezone = 'Asia/Hong_Kong';
-- SET timezone = 'Asia/Kuala_Lumpur';
-- SET timezone = 'Asia/Taipei';
SET timezone = 'Asia/Manila'; -- <-- EDIT THIS LINE

-- Make this setting persistent
ALTER DATABASE postgres SET timezone = 'Asia/Manila'; -- <-- EDIT THIS LINE

-- Update existing timestamps (add 8 hours to convert UTC to local)
UPDATE break_sessions 
SET 
  start_time = start_time + INTERVAL '8 hours',
  end_time = CASE WHEN end_time IS NOT NULL THEN end_time + INTERVAL '8 hours' ELSE NULL END,
  pause_time = CASE WHEN pause_time IS NOT NULL THEN pause_time + INTERVAL '8 hours' ELSE NULL END,
  resume_time = CASE WHEN resume_time IS NOT NULL THEN resume_time + INTERVAL '8 hours' ELSE NULL END,
  created_at = created_at + INTERVAL '8 hours'
WHERE start_time < NOW() - INTERVAL '6 hours';

-- Verify the change
SELECT current_setting('timezone') as new_timezone, NOW() as current_local_time;