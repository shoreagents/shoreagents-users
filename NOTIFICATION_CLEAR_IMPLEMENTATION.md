# Notification Clear Implementation

## Overview
This implementation adds a "clear" boolean column to the notifications table to enable soft deletion instead of permanent deletion. When `clear = true`, notifications are hidden from users but remain in the database.

## Changes Made

### 1. Database Migration
- **File**: `migrations/072_add_clear_column_to_notifications.sql`
- **Changes**:
  - Added `clear BOOLEAN DEFAULT false` column to notifications table
  - Added index for better performance when filtering by clear status
  - Added comment documenting the purpose of the clear column
  - Updated existing notifications to ensure they are not cleared by default

### 2. Migration Runner
- **File**: `scripts/run-migration-072.js`
- **Purpose**: Executes the migration to add the clear column

### 3. API Updates

#### GET /api/notifications
- **File**: `src/app/api/notifications/route.ts`
- **Change**: Added filter `AND (n.clear IS NULL OR n.clear = false)` to exclude cleared notifications

#### POST /api/notifications/delete
- **File**: `src/app/api/notifications/delete/route.ts`
- **Change**: Changed from `DELETE` to `UPDATE` query that sets `clear = true` instead of deleting records

#### POST /api/notifications/mark-read
- **File**: `src/app/api/notifications/mark-read/route.ts`
- **Change**: Added filter `AND (n.clear IS NULL OR n.clear = false)` to only update non-cleared notifications

### 4. Test Script
- **File**: `scripts/test-notification-clear.js`
- **Purpose**: Tests the implementation to ensure it works correctly

## How It Works

### Before (Hard Deletion)
```sql
DELETE FROM notifications WHERE id = 123;
```
- Notification is permanently removed from database
- Cannot be recovered
- No audit trail

### After (Soft Deletion)
```sql
UPDATE notifications SET clear = true WHERE id = 123;
```
- Notification is marked as cleared but remains in database
- Can be recovered if needed
- Maintains audit trail
- Hidden from users in all queries

### Query Filtering
All notification queries now include:
```sql
WHERE (n.clear IS NULL OR n.clear = false)
```
This ensures that:
- New notifications (clear = false) are visible
- Old notifications without the clear column (clear = NULL) are visible
- Cleared notifications (clear = true) are hidden

## Benefits

1. **Data Preservation**: Notifications are not permanently lost
2. **Audit Trail**: Complete history of all notifications
3. **Recovery**: Cleared notifications can be restored if needed
4. **Performance**: Index on clear column for efficient filtering
5. **Backward Compatibility**: Existing notifications work without modification

## Usage

### To Clear Notifications
Use the existing delete API endpoint - it now performs soft deletion:
```javascript
fetch('/api/notifications/delete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: [1, 2, 3], email: 'user@example.com' })
})
```

### To View All Notifications (Including Cleared)
For administrative purposes, you can query without the clear filter:
```sql
SELECT * FROM notifications WHERE user_id = $1;
```

### To Restore Cleared Notifications
```sql
UPDATE notifications SET clear = false WHERE id = $1;
```

## Migration Steps

1. Run the migration:
   ```bash
   node scripts/run-migration-072.js
   ```

2. Test the implementation:
   ```bash
   node scripts/test-notification-clear.js
   ```

3. Verify that existing notifications are still visible
4. Test that "deleting" notifications now hides them instead of removing them

## Notes

- The clear column defaults to `false`, so all existing notifications remain visible
- The implementation is backward compatible with existing code
- No changes needed to notification creation logic
- All existing API endpoints continue to work as expected
