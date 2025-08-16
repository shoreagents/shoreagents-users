# Daily Break Reset Setup Guide

## Overview
The ShoreAgents Dashboard uses a database-driven approach to reset daily break allowances for all agents. Instead of using localStorage, the system tracks break usage by date in the database.

## Database Schema Changes

### New Column Added
```sql
ALTER TABLE public.break_sessions 
ADD COLUMN break_date DATE DEFAULT CURRENT_DATE NOT NULL;
```

### Key Functions Created
1. **`can_agent_take_break(agent_id, break_type)`** - Check if agent can take a specific break today
2. **`get_agent_daily_breaks(agent_id)`** - Get complete break summary for an agent today
3. **`reset_daily_breaks()`** - Administrative function for logging reset operations

## How Daily Reset Works

### Automatic Reset Logic
- **No Data Deletion**: Historical break data is preserved for reporting
- **Date-Based Filtering**: Break availability is checked using `break_date = CURRENT_DATE`
- **Natural Reset**: Each new day, agents automatically get fresh break allowances
- **One Break Per Type**: Each agent can take Morning, Lunch, and Afternoon breaks once per day

### Example Queries
```sql
-- Check if agent can take morning break today
SELECT can_agent_take_break(2, 'Morning');

-- Get agent's break summary for today
SELECT * FROM get_agent_daily_breaks(2);

-- Manual check of today's breaks for an agent
SELECT break_type, COUNT(*) 
FROM break_sessions 
WHERE agent_user_id = 2 
AND break_date = CURRENT_DATE 
AND end_time IS NOT NULL
GROUP BY break_type;
```

## Automation Setup

### Option 1: Linux/Unix Cron Job
```bash
# Edit crontab
crontab -e

# Add this line to run daily at midnight
0 0 * * * psql -d shoreagents_db -f /path/to/scripts/daily-break-reset.sql >> /var/log/break-reset.log 2>&1
```

### Option 2: Windows Task Scheduler
1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at 12:00 AM
4. Set action: Start a program
5. Program: `psql.exe`
6. Arguments: `-d shoreagents_db -f C:\path\to\scripts\daily-break-reset.sql`

### Option 3: Database Scheduled Job (PostgreSQL)
```sql
-- Install pg_cron extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily reset at midnight
SELECT cron.schedule('daily-break-reset', '0 0 * * *', 
  'SELECT reset_daily_breaks();'
);
```

## API Integration

Update your break status API to use the new date-based logic:

```sql
-- Updated query for checking break availability
SELECT 
  break_type,
  can_agent_take_break($1, break_type) as available
FROM (VALUES 
  ('Morning'::break_type_enum),
  ('Lunch'::break_type_enum),
  ('Afternoon'::break_type_enum)
) AS types(break_type);
```

## Testing the Reset

### Manual Test
```sql
-- 1. Start a break session
INSERT INTO break_sessions (agent_user_id, break_type, start_time, break_date)
VALUES (2, 'Morning', NOW(), CURRENT_DATE);

-- 2. Check availability (should be false)
SELECT can_agent_take_break(2, 'Morning');

-- 3. Simulate next day
UPDATE break_sessions SET break_date = CURRENT_DATE - 1 WHERE agent_user_id = 2;

-- 4. Check availability (should be true now)
SELECT can_agent_take_break(2, 'Morning');
```

### Monitoring
- Check logs: `/var/log/break-reset.log`
- Verify daily: `SELECT * FROM get_agent_daily_breaks(agent_id);`
- Historical data: `SELECT break_date, COUNT(*) FROM break_sessions GROUP BY break_date ORDER BY break_date DESC;`

## Benefits

✅ **No localStorage Dependency**: Pure database-driven approach
✅ **Historical Data Preserved**: Complete break history for reporting
✅ **Automatic Reset**: No manual intervention required
✅ **Scalable**: Works for any number of agents
✅ **Reliable**: Database-level consistency and transactions
✅ **Auditable**: Complete trail of all break activities

## Troubleshooting

### Common Issues
1. **Cron not running**: Check `systemctl status cron` or `service cron status`
2. **Database connection**: Verify PostgreSQL credentials and network access
3. **Permissions**: Ensure script has read access and database user has proper privileges
4. **Time zones**: Ensure server and database are in the same timezone

### Manual Reset
If automated reset fails, you can manually verify the system:
```sql
-- Check today's break usage across all agents
SELECT agent_user_id, break_type, COUNT(*) as breaks_taken
FROM break_sessions 
WHERE break_date = CURRENT_DATE 
GROUP BY agent_user_id, break_type 
ORDER BY agent_user_id, break_type;
``` 