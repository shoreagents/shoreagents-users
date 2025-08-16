-- Set Database Timezone to Asia/Manila
-- Run with: psql -U postgres -d shoreagents_db -f set-database-timezone.sql

-- 1. Show current timezone before change
SELECT 'BEFORE CHANGE:' as status;
SELECT 
    setting as current_timezone,
    NOW() as current_timestamp
FROM pg_settings 
WHERE name = 'timezone';

-- 2. Set timezone for current session
SET TIMEZONE = 'Asia/Manila';

-- 3. Show timezone after session change
SELECT 'AFTER SESSION CHANGE:' as status;
SELECT 
    setting as current_timezone,
    NOW() as current_timestamp
FROM pg_settings 
WHERE name = 'timezone';

-- 4. To make this permanent, you need to update postgresql.conf
-- This script shows what needs to be done:
SELECT 'TO MAKE PERMANENT:' as status;
SELECT 'Add this line to postgresql.conf: timezone = ''Asia/Manila''' as instruction
UNION ALL
SELECT 'Then restart PostgreSQL server' as instruction
UNION ALL 
SELECT 'Or use ALTER SYSTEM command (requires superuser):' as instruction
UNION ALL
SELECT 'ALTER SYSTEM SET timezone = ''Asia/Manila'';' as instruction
UNION ALL
SELECT 'SELECT pg_reload_conf();' as instruction;

-- 5. Alternative: Set timezone using ALTER SYSTEM (requires superuser privileges)
-- Uncomment the lines below if you have superuser access:

/*
ALTER SYSTEM SET timezone = 'Asia/Manila';
SELECT pg_reload_conf();
SELECT 'Timezone set permanently to Asia/Manila' as result;
*/

-- 6. Test the timezone change
SELECT 'TESTING TIMEZONE:' as status;
SELECT 
    'Asia/Manila' as timezone_name,
    NOW() as local_time,
    NOW() AT TIME ZONE 'UTC' as utc_time,
    CURRENT_DATE as local_date;

-- 7. Show what this means for break sessions
SELECT 'BREAK SESSIONS IMPACT:' as status;
SELECT 
    'break_date will use Asia/Manila date' as impact
UNION ALL
SELECT 'start_time will use Asia/Manila timestamp' as impact
UNION ALL
SELECT 'Daily reset at midnight Asia/Manila time' as impact; 