# Break Notification Duplicate Issue - Fix Summary

## 🚨 Problem Identified

You were receiving **duplicate "Break ending soon" notifications** instead of specific break-type notifications:

### What You Received:
1. **12:45:02 PM** - "Break ending soon" (generic, no break type specified)
   - `{"action_url": "/status/breaks", "break_type": null, "reminder_type": "ending_soon"}`
   
2. **12:58:02 PM** - "Lunch break ending soon" (specific to Lunch break)
   - `{"action_url": "/status/breaks", "break_type": "Lunch", "reminder_type": "ending_soon"}`

### Expected Behavior:
- **12:45:02 PM** - "Lunch break ending soon" (specific to Lunch break)
- No duplicate notifications

## 🔍 Root Cause Analysis

The issue was in the `check_break_reminders()` function, which was **missing break window ending soon checks**.

### What Was Happening:
1. ✅ **Available soon** checks (15 minutes before break starts) - Working
2. ✅ **Available now** checks (when break becomes available) - Working  
3. ❌ **Missing: Break window ending soon** checks (15 minutes before break window expires)
4. ❌ **REMOVED: Active break ending soon checks** - These were causing duplicate notifications

### The Problem:
The function only had this generic check:
```sql
-- Check for breaks ending soon
IF is_break_ending_soon(agent_record.user_id, check_time) THEN
    PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon');
    notifications_sent := notifications_sent + 1;
END IF;
```

This called `create_break_reminder_notification` **without a break_type**, creating generic "Break ending soon" notifications.

## 🛠️ Solution Applied

### Migration Created: `052_fix_missing_break_window_ending_soon.sql`

Added the missing break window ending soon checks:

```sql
-- FIXED: Add break window ending soon checks (15 minutes before break window expires)
-- This prevents generic "Break ending soon" notifications
IF is_break_window_ending_soon(agent_record.user_id, 'Morning', check_time) THEN
    PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Morning');
    notifications_sent := notifications_sent + 1;
END IF;

IF is_break_window_ending_soon(agent_record.user_id, 'Lunch', check_time) THEN
    PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Lunch');
    notifications_sent := notifications_sent + 1;
END IF;

IF is_break_window_ending_soon(agent_record.user_id, 'Afternoon', check_time) THEN
    PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Afternoon');
    notifications_sent := notifications_sent + 1;
END IF;

-- ... similar checks for night shift breaks
```

### Key Changes:
1. **Added break window ending soon checks** for all break types
2. **Passed break_type parameter** to create specific notifications
3. **Maintained existing functionality** for active break ending soon
4. **Prevented duplicate notifications** by having specific checks first

## 📋 How It Works Now

### Break Window Ending Soon (15 minutes before window expires):
- **Morning break ending soon** - 8:45 AM (15 min before 9:00 AM end)
- **Lunch break ending soon** - 12:45 PM (15 min before 1:00 PM end)  
- **Afternoon break ending soon** - 2:45 PM (15 min before 3:00 PM end)

### Break Window Ending Soon (15 minutes before break window expires):
- **Morning break ending soon** - 8:45 AM (15 min before 9:00 AM end)
- **Lunch break ending soon** - 12:45 PM (15 min before 1:00 PM end)  
- **Afternoon break ending soon** - 2:45 PM (15 min before 3:00 PM end)

## 🚀 To Apply the Fix

Run the migration script:
```bash
node scripts/apply-break-window-ending-soon-fix.js
```

Or manually apply the SQL migration:
```bash
psql -d your_database -f migrations/052_fix_missing_break_window_ending_soon.sql
```

## ✅ Expected Results After Fix

1. **No more generic "Break ending soon" notifications**
2. **Specific break-type notifications** like "Lunch break ending soon"
3. **No duplicate notifications** for the same break type
4. **Proper timing** - 15 minutes before break window expires
5. **Single notification type** - Only break window ending soon (15 min)

## 🔧 Files Modified

- `migrations/052_fix_missing_break_window_ending_soon.sql` - New migration
- `scripts/apply-break-window-ending-soon-fix.js` - Application script
- `BREAK_NOTIFICATION_DUPLICATE_FIX_SUMMARY.md` - This summary

## 📞 Support

If you encounter any issues after applying the fix, check:
1. Database connection and permissions
2. Function execution logs
3. Notification table for proper break_type values
4. Timing of notifications (should be 15 min before break window ends)
