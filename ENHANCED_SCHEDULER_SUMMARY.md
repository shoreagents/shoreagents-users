# Enhanced Break Reminder Scheduler with Global Activity Timer

## Overview
The enhanced scheduler now includes a **Global Activity Timer** that monitors agent shift starts every minute and automatically resets activity data when agents begin their shifts.

## What's New

### 1. Global Activity Timer Function
- **Function**: `check_and_reset_activity_for_shift_starts()`
- **Purpose**: Detects when agents start their shifts and resets their daily activity data
- **Frequency**: Called every minute by the scheduler
- **Logic**: Checks if current time is within 2 minutes of shift start time

### 2. Enhanced Scheduler Features
- **Break Reminders**: 15 minutes before break starts
- **Global Activity Timer**: Monitors shift starts and resets activity data
- **Next-day Precreation**: Creates new daily rows when shifts end
- **Unified Cycle**: All functions run in sequence every minute

## How It Works

### Every Minute, the Scheduler:
1. **Checks Break Reminders** - Sends notifications for upcoming breaks
2. **Checks Global Activity Timer** - Monitors for shift starts
3. **Precreates Next-day Rows** - Creates new daily activity rows when shifts end

### Global Activity Timer Logic:
```
For each agent:
├── Parse shift time (e.g., "6:00 AM - 3:00 PM")
├── Calculate shift start time for today
├── Check if current time is within 2 minutes of shift start
└── If yes:
    ├── Create new activity row for today (if none exists)
    └── OR Reset existing row to 0 values
```

## Benefits

### ✅ **Real-time Monitoring**
- Detects shift starts within 2 minutes
- No more waiting for manual resets
- Automatic activity data management

### ✅ **Data Integrity**
- Activity data resets exactly when shifts start
- Prevents data mixing between days
- Maintains complete historical records

### ✅ **Efficient Operation**
- Single scheduler handles all functions
- Runs every minute for maximum responsiveness
- Handles both day and night shifts correctly

## Files Created/Modified

### New Files:
- `scripts/global-activity-timer.sql` - Database function
- `scripts/apply-global-activity-timer.js` - Application script
- `ENHANCED_SCHEDULER_SUMMARY.md` - This documentation

### Modified Files:
- `scripts/break-reminder-scheduler.js` - Enhanced with global activity timer

## Setup Instructions

### 1. Apply the Database Function:
```bash
node scripts/apply-global-activity-timer.js
```

### 2. Restart the Enhanced Scheduler:
```bash
node scripts/break-reminder-scheduler.js
```

## Example Output

```
🚀 Starting enhanced break reminder scheduler (checking every 60 seconds, aligned to top of minute)
📋 Scheduler functions:
   • Break reminders - 15 minutes before break starts
   • Dynamic timing based on agent shift times from job_info table
   • Global activity timer - monitors shift starts and resets activity data
   • Next-day activity precreation - creates new daily rows when shifts end

🔍 [9:39:00 AM] Checking break reminders...
✅ [9:39:00 AM] No break reminders needed (45ms)

⏰ [9:39:00 AM] Checking global activity timer for shift starts...
🔄 [9:39:00 AM] Reset activity data for 3 agents starting shifts (67ms)

🗓️  [9:39:00 AM] Pre-created 0 next-day activity rows
✅ [9:39:00 AM] Full scheduler cycle completed
```

## Shift Start Detection

### Day Shifts (e.g., 6:00 AM - 3:00 PM):
- Reset occurs at 6:00 AM each day
- Activity data starts fresh for the new shift

### Night Shifts (e.g., 10:00 PM - 6:00 AM):
- Reset occurs at 10:00 PM each day
- Handles midnight crossing correctly

### Timing Precision:
- **2-minute window** around shift start time
- Accounts for slight timing variations
- Prevents missed resets due to minor delays

## Data Flow

```
Agent Shift Starts → Global Activity Timer Detects → Activity Data Reset → New Day Begins
        ↓                           ↓                      ↓              ↓
  6:00 AM Daily              Within 2 min           today_active_seconds = 0    Fresh Start
  10:00 PM Night             of shift start         today_inactive_seconds = 0
```

## Monitoring and Debugging

### Test Individual Functions:
```javascript
// Test break reminders only
await scheduler.testBreakReminders();

// Test global activity timer only
await scheduler.testGlobalActivityTimer();

// Test full cycle
await scheduler.testCheck();
```

### Database Queries:
```sql
-- Check function execution
SELECT check_and_reset_activity_for_shift_starts();

-- View recent activity resets
SELECT * FROM activity_data WHERE updated_at >= NOW() - INTERVAL '1 hour';
```

## Summary

The enhanced scheduler now provides **real-time, automated activity management** that:
- ✅ Monitors shift starts every minute
- ✅ Automatically resets activity data at shift boundaries
- ✅ Maintains complete historical records
- ✅ Handles both day and night shifts
- ✅ Integrates seamlessly with existing break reminder system

This eliminates the need for manual activity resets and ensures data accuracy across all agent shifts.
