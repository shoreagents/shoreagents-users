# Break Duration Calculation Fix

## Problem
When breaks were auto-ended due to being outside the valid time window, the `duration_minutes` was calculated incorrectly.

### Example of the issue:
- **Morning break** should be 15 minutes
- User starts break at `2025-08-05 11:14:40`
- User pauses the break and doesn't resume
- Break auto-ends at `2025-08-05 12:16:35` (outside valid time window)
- **Result**: Duration shows 62 minutes instead of the actual time used

## Root Cause
The database trigger function `calculate_break_duration()` was calculating duration as:
```sql
duration_minutes = EXTRACT(EPOCH FROM (end_time - start_time)) / 60
```

For paused breaks that were auto-ended, this meant:
- `start_time`: When break started
- `end_time`: When break was auto-ended (could be much later)
- **Problem**: Duration included the entire time from start to auto-end, not the actual break time used

## Solution
Updated the `calculate_break_duration()` function to handle paused breaks correctly:

### For paused breaks that were resumed:
```sql
duration_minutes = EXTRACT(EPOCH FROM (
    (pause_time - start_time) + 
    (end_time - resume_time)
)) / 60
```

### For paused breaks that were auto-ended (never resumed):
```sql
duration_minutes = EXTRACT(EPOCH FROM (pause_time - start_time)) / 60
```

## What this fixes:
- ✅ Paused breaks that are auto-ended now show correct duration
- ✅ Duration is calculated from `start_time` to `pause_time` (actual break time used)
- ✅ Instead of from `start_time` to `end_time` (which could be much later)
- ✅ Applies to all future break sessions

## Migration Applied
- **File**: `migrations/027_fix_break_duration_calculation.sql`
- **Script**: `scripts/fix-break-duration.js`
- **API**: `src/app/api/database/migrate/route.ts`

## Testing
To test the fix:
1. Start a break
2. Pause the break
3. Wait for the break to auto-end (outside valid time window)
4. Check that the duration shows the actual time used, not the full time from start to auto-end

## Example Results
**Before fix:**
- Start: `2025-08-05 11:14:40`
- Pause: `2025-08-05 11:16:40` (2 minutes used)
- Auto-end: `2025-08-05 12:16:35` (outside valid time)
- Duration: **62 minutes** ❌

**After fix:**
- Start: `2025-08-05 11:14:40`
- Pause: `2025-08-05 11:16:40` (2 minutes used)
- Auto-end: `2025-08-05 12:16:35` (outside valid time)
- Duration: **2 minutes** ✅ 