# Overdue Task System

This system automatically manages overdue tasks to prevent notification spamming and provides better task organization.

## Overview

The overdue task system consists of:
1. **Overdue Column**: A new global column in the task-activity page for overdue tasks
2. **Automatic Task Movement**: Overdue tasks are automatically moved to the Overdue column
3. **Smart Notifications**: Overdue notifications are only sent once per task to prevent spamming
4. **Scheduled Checks**: Automatic checks every 5 minutes for overdue tasks

**Note**: This system works with the global task groups structure where all users share the same task columns. The system includes the "On Hold" column for tasks that are temporarily paused.

## How It Works

### 1. Overdue Column
- Added as the 6th column (position 5) in the task-activity page
- Has a red color scheme (`bg-red-100 dark:bg-red-950/20`)
- **Global column** - shared by all users (task_groups are now global)
- **Column Order**: To Do (0) → In Progress (1) → Review (2) → On Hold (3) → Done (4) → Overdue (5)

### 2. Notification Logic
- **Due Soon Notifications**: Sent for tasks due within 24 hours (only once per 12 hours)
- **Overdue Notifications**: Sent only once per task (within 6 hours of becoming overdue)
- **No Spamming**: Once a task is moved to the Overdue column, no more overdue notifications are sent

### 3. Automatic Task Movement
- Tasks are automatically moved to the Overdue column when they become overdue
- This happens during the scheduled checks every 5 minutes
- **Important**: Tasks already in the "Done" column are **protected** and will NOT be moved to Overdue
- Tasks maintain their position and other properties when moved

## Database Functions

### `move_overdue_tasks_to_overdue_column()`
- Automatically moves overdue tasks to the Overdue column
- Returns the number of tasks moved

### `check_overdue_task_notifications()`
- Sends overdue notifications only for tasks not in the Overdue column
- Prevents notification spamming

### `check_task_due_notifications()`
- Sends due soon notifications for tasks not yet overdue
- Respects the Overdue column to prevent duplicate notifications

### `check_all_task_notifications()`
- Main function that combines all overdue task logic
- First moves overdue tasks, then sends notifications

## Scheduler Methods

The integrated task notification scheduler provides these methods:

### `processOverdueTasks()`
- Manually triggers overdue task processing
- Returns count of tasks moved and notifications sent

### `getOverdueStats()`
- Returns statistics about overdue tasks:
  - Current overdue task count
  - Tasks that will become overdue soon (within 1 hour)
  - Recent overdue notifications (last 24 hours)

### `setInterval(seconds)`
- Changes the check interval dynamically
- Default is 5 minutes (300 seconds)

## Setup and Usage

### 1. Run the Migration
```sql
-- Apply the migration file
\i migrations/043_add_overdue_column_and_notifications.sql
```

### 2. Start the Integrated Scheduler
The overdue task management is now integrated into the existing task notification scheduler:

```bash
# Run the integrated scheduler (includes overdue task management)
npm run socket

# Or run it directly
node socket-server.js
```

**Note**: The existing `scripts/task-notification-scheduler.js` now handles both:
- Regular task notifications (due soon, overdue)
- Moving overdue tasks to the Overdue column
- Preventing notification spamming

### 3. Manual Database Checks
```sql
-- Check how many tasks were moved to overdue
SELECT move_overdue_tasks_to_overdue_column();

-- Check how many notifications were sent
SELECT check_all_task_notifications();

-- View overdue tasks
SELECT t.*, tg.title as group_name 
FROM tasks t 
JOIN task_groups tg ON t.group_id = tg.id 
WHERE tg.title = 'Overdue' AND t.status = 'active';
```

## Configuration

### Notification Intervals
- **Due Soon**: Every 12 hours
- **Overdue**: Every 6 hours
- **Scheduler**: Every 5 minutes (configurable)

### Timezone
All timestamps use `Asia/Manila` timezone for consistency.

## Benefits

1. **No More Spam**: Users only receive overdue notifications once per task
2. **Better Organization**: Overdue tasks are clearly separated in their own column
3. **Automatic Management**: No manual intervention required
4. **Improved UX**: Users can easily see and manage overdue tasks
5. **Efficient Notifications**: Reduces notification fatigue
6. **Integrated System**: Uses existing task notification scheduler (no additional processes)
7. **Real-time Monitoring**: Provides statistics and monitoring capabilities
8. **Smart Protection**: Completed tasks in "Done" column are protected from moving to "Overdue"

## Troubleshooting

### Tasks Not Moving to Overdue
- Check if the Overdue column exists for the user
- Verify the scheduler is running
- Check database logs for errors

### Notifications Not Sending
- Verify the notification functions exist in the database
- Check if notifications table has the required structure
- Ensure the scheduler has proper database permissions

### Performance Issues
- The system processes tasks in batches
- Consider adding database indexes if dealing with large numbers of tasks
- Monitor the scheduler logs for performance metrics

## Future Enhancements

- **Custom Overdue Thresholds**: Allow users to set custom overdue timeframes
- **Overdue Task Reports**: Generate reports on overdue task patterns
- **Escalation Notifications**: Notify managers about long-overdue tasks
- **Overdue Task Analytics**: Track overdue task trends and causes
