# Database Timezone Setup Guide

## Overview
Setting the correct timezone for your PostgreSQL database is crucial for the ShoreAgents break management system to work correctly. This ensures that daily break resets happen at the right time and timestamps are accurate.

## Current System Analysis
- **Application Server**: Asia/Manila (UTC+8)
- **Target Database Timezone**: Asia/Manila
- **Break Reset Time**: Midnight Asia/Manila time

## Step 1: Check Current Database Timezone

### Run the Check Script
```bash
psql -U postgres -d shoreagents_db -f scripts/check-database-timezone.sql
```

### Manual Check
```sql
-- Connect to your database and run:
SHOW timezone;
SELECT NOW(), NOW() AT TIME ZONE 'UTC';
```

## Step 2: Set Database Timezone

### Method A: Session-Level (Temporary)
```sql
SET TIMEZONE = 'Asia/Manila';
```
**Note**: This only affects the current session.

### Method B: Database-Level (Permanent)
```sql
-- Requires superuser privileges
ALTER SYSTEM SET timezone = 'Asia/Manila';
SELECT pg_reload_conf();
```

### Method C: Configuration File (Most Permanent)
1. **Find PostgreSQL config file**:
   ```bash
   # Find postgresql.conf location
   psql -U postgres -c "SHOW config_file;"
   ```

2. **Edit postgresql.conf**:
   ```bash
   # Add or modify this line:
   timezone = 'Asia/Manila'
   ```

3. **Restart PostgreSQL**:
   ```bash
   # On Linux/Mac
   sudo systemctl restart postgresql
   
   # On Windows (run as administrator)
   net stop postgresql-x64-14
   net start postgresql-x64-14
   ```

## Step 3: Apply Database Timezone Script

### Run the Setup Script
```bash
psql -U postgres -d shoreagents_db -f scripts/set-database-timezone.sql
```

### Verify the Change
```sql
SELECT 
    setting as timezone,
    NOW() as current_time,
    CURRENT_DATE as current_date
FROM pg_settings 
WHERE name = 'timezone';
```

## Step 4: Update Break APIs (Optional)

If you want explicit timezone handling in your APIs, update them:

### Update Break Start API
```sql
-- In src/app/api/breaks/start/route.ts
const insertQuery = `
  INSERT INTO break_sessions (agent_user_id, break_type, start_time, break_date)
  VALUES ($1, $2::break_type_enum, 
    CURRENT_TIMESTAMP, 
    CURRENT_DATE)
  RETURNING id, agent_user_id, break_type, start_time, break_date, created_at
`;
```

### Alternative: Explicit Timezone
```sql
-- If you want to be very explicit:
const insertQuery = `
  INSERT INTO break_sessions (agent_user_id, break_type, start_time, break_date)
  VALUES ($1, $2::break_type_enum, 
    NOW() AT TIME ZONE 'Asia/Manila', 
    CURRENT_DATE AT TIME ZONE 'Asia/Manila')
  RETURNING *
`;
```

## Step 5: Test the Setup

### Test Daily Reset Logic
```sql
-- Check if break availability works correctly
SELECT can_agent_take_break(2, 'Morning');

-- Check daily break summary
SELECT * FROM get_agent_daily_breaks(2);

-- Verify timezone is consistent
SELECT 
  NOW() as db_time,
  CURRENT_DATE as db_date,
  timezone() as db_timezone;
```

### Test Break Session Creation
1. Start a break through the application
2. Check the database:
   ```sql
   SELECT 
     break_type,
     start_time,
     break_date,
     start_time::date = break_date as dates_match
   FROM break_sessions 
   ORDER BY id DESC 
   LIMIT 1;
   ```

## Troubleshooting

### Common Issues

#### 1. Permission Denied for ALTER SYSTEM
```bash
ERROR: must be superuser to execute ALTER SYSTEM
```
**Solution**: Use postgresql.conf method or ask your database administrator.

#### 2. Invalid Timezone Name
```bash
ERROR: invalid value for parameter "timezone": "Asia/Manila"
```
**Solution**: Check available timezones:
```sql
SELECT name FROM pg_timezone_names WHERE name LIKE '%Manila%';
```

#### 3. Configuration Not Loading
**Solution**: Restart PostgreSQL service and verify:
```sql
SELECT pg_reload_conf();
SHOW timezone;
```

### Verification Checklist

- [ ] Database timezone shows as "Asia/Manila"
- [ ] `NOW()` returns correct local time (UTC+8)
- [ ] `CURRENT_DATE` returns correct local date
- [ ] Break sessions show correct timestamps
- [ ] Daily reset happens at midnight Manila time

## Production Considerations

### 1. Coordinate with Team
- Notify all developers about timezone change
- Update documentation and deployment scripts
- Test in staging environment first

### 2. Backup Before Changes
```bash
pg_dump -U postgres shoreagents_db > backup_before_timezone_change.sql
```

### 3. Monitor After Changes
- Check break session timestamps for accuracy
- Verify daily reset timing
- Monitor for any application errors

## Alternative: Use TIMESTAMPTZ

For future database designs, consider using `TIMESTAMPTZ` instead of `TIMESTAMP`:

```sql
-- Future migration (optional)
ALTER TABLE break_sessions 
ALTER COLUMN start_time TYPE TIMESTAMPTZ,
ALTER COLUMN end_time TYPE TIMESTAMPTZ,
ALTER COLUMN pause_time TYPE TIMESTAMPTZ,
ALTER COLUMN resume_time TYPE TIMESTAMPTZ,
ALTER COLUMN created_at TYPE TIMESTAMPTZ;
```

This stores timezone information with the timestamp, making it more robust.

## Summary

1. **Check current timezone**: Run check script
2. **Set timezone**: Use ALTER SYSTEM or postgresql.conf
3. **Restart PostgreSQL**: Apply changes
4. **Test thoroughly**: Verify break system works correctly
5. **Monitor**: Ensure daily resets happen at correct time

Your break management system will now use Asia/Manila timezone consistently! 