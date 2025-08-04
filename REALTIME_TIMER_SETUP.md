# 🚀 Real-Time Activity Timer Setup

## Overview
This system uses Socket.IO for real-time activity tracking with minimal database load:

- **Frontend**: React hooks with Socket.IO client
- **Backend**: Express + Socket.IO server
- **Database**: PostgreSQL with time tracking columns
- **Performance**: Updates every 5 seconds, real-time state changes

## 🛠️ Setup Instructions

### 1. Add Database Columns
Run this SQL in your database to add the missing columns:

```sql
-- Add time tracking columns to activity_data table
ALTER TABLE activity_data 
ADD COLUMN IF NOT EXISTS today_active_seconds INTEGER DEFAULT 0;

ALTER TABLE activity_data 
ADD COLUMN IF NOT EXISTS today_inactive_seconds INTEGER DEFAULT 0;

ALTER TABLE activity_data 
ADD COLUMN IF NOT EXISTS last_session_start TIMESTAMP WITH TIME ZONE;

-- Update the notification function
CREATE OR REPLACE FUNCTION notify_activity_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'activity_change',
        json_build_object(
            'user_id', NEW.user_id,
            'is_currently_active', NEW.is_currently_active,
            'today_active_seconds', NEW.today_active_seconds,
            'today_inactive_seconds', NEW.today_inactive_seconds,
            'last_session_start', NEW.last_session_start,
            'updated_at', NEW.updated_at
        )::text
    );
    RETURN NEW;
END;
$$ language 'plpgsql';
```

### 2. Environment Variables
Add to your `.env.local`:
```
NEXT_PUBLIC_SOCKET_URL=http://localhost:3002
SOCKET_PORT=3002
```

### 3. Start the Servers
Run both the Next.js app and Socket.IO server:

```bash
# Terminal 1: Start Next.js app
npm run dev

# Terminal 2: Start Socket.IO server
npm run socket

# Or run both together:
npm run dev:socket
```

### 4. Test the System
Visit `/test-activity` to see the real-time timer in action!

## 🎯 Features

### ✅ Real-Time Performance
- **Socket.IO**: Instant updates, no polling
- **5-second intervals**: Minimal database load
- **Activity detection**: Mouse, keyboard, scroll, touch events
- **State management**: Automatic active/inactive switching

### ✅ Database Efficiency
- **Smart updates**: Only when state changes
- **Session tracking**: Proper start/stop times
- **Time accumulation**: Accurate active/inactive seconds
- **Connection pooling**: Efficient database connections

### ✅ User Experience
- **Live stopwatch**: Real-time counting display
- **Visual indicators**: Active/inactive status
- **Connection status**: Socket.IO connection monitoring
- **Error handling**: Graceful fallbacks

## 🔧 How It Works

### Frontend (`useSocketTimer` hook)
1. **Connects** to Socket.IO server
2. **Authenticates** with user email
3. **Receives** initial timer data
4. **Sends** activity state changes
5. **Updates** every 5 seconds
6. **Displays** real-time counters

### Backend (Socket.IO server)
1. **Handles** user authentication
2. **Manages** client sessions
3. **Processes** activity changes
4. **Updates** database efficiently
5. **Broadcasts** updates to all clients
6. **Handles** disconnections gracefully

### Database
1. **Stores** active/inactive seconds
2. **Tracks** session start times
3. **Updates** only when needed
4. **Maintains** data integrity

## 🎨 Usage Example

```typescript
import { useSocketTimer } from '@/hooks/use-socket-timer'

function MyComponent() {
  const { 
    timerData, 
    connectionStatus, 
    setActivityState, 
    isAuthenticated 
  } = useSocketTimer(userEmail)

  // timerData contains:
  // - isActive: boolean
  // - activeSeconds: number
  // - inactiveSeconds: number
  // - sessionStart: string | null
}
```

## 🚨 Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check `DATABASE_URL` in environment
- Verify database exists and is accessible

### Socket.IO Connection Issues
- Check if Socket.IO server is running on port 3001
- Verify `NEXT_PUBLIC_SOCKET_URL` environment variable
- Check browser console for connection errors

### Missing Columns Error
- Run the SQL commands above to add missing columns
- Restart the application after adding columns

## 🎉 Benefits

1. **Performance**: Much faster than polling
2. **Accuracy**: Real-time state changes
3. **Efficiency**: Minimal database load
4. **Reliability**: Proper error handling
5. **Scalability**: Socket.IO handles multiple clients
6. **User Experience**: Instant updates and smooth UI

The system will now provide real-time activity tracking with excellent performance and minimal database load! 🚀 