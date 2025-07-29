-- Check Database Timezone Settings
-- Run with: psql -U postgres -d shoreagents_db -f check-database-timezone.sql

-- 1. Check current timezone setting
SELECT 
    name as setting_name, 
    setting as current_value,
    short_desc as description
FROM pg_settings 
WHERE name = 'timezone';

-- 2. Show current timestamps
SELECT 
    NOW() as local_timestamp,
    NOW() AT TIME ZONE 'UTC' as utc_timestamp,
    CURRENT_DATE as local_date,
    CURRENT_DATE AT TIME ZONE 'UTC' as utc_date;

-- 3. Show timezone abbreviations
SELECT 
    abbrev,
    utc_offset
FROM pg_timezone_abbrevs 
WHERE abbrev IN ('PST', 'PHT', 'UTC', 'GMT');

-- 4. Show available timezone names (filtered for Asia/Manila)
SELECT name 
FROM pg_timezone_names 
WHERE name LIKE '%Manila%' OR name LIKE '%Philippines%';

-- 5. Test what times would be for different timezones
SELECT 
    'Current' as timezone_type,
    NOW() as timestamp_value
UNION ALL
SELECT 
    'UTC' as timezone_type,
    NOW() AT TIME ZONE 'UTC' as timestamp_value
UNION ALL
SELECT 
    'Asia/Manila' as timezone_type,
    NOW() AT TIME ZONE 'Asia/Manila' as timestamp_value;

-- 6. Check if break_sessions table has timezone-aware columns
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'break_sessions' 
AND column_name IN ('start_time', 'end_time', 'pause_time', 'resume_time', 'created_at', 'break_date')
ORDER BY ordinal_position; 