# Simple Break Management Schema

This document explains the simple break management system database schema for ShoreAgents.

## Overview

The break management system consists of:
- **Database**: `break_sessions` table for historical break data
- **localStorage**: Current active break session for real-time tracking
- **Break Types**: morning, lunch, afternoon

## Database Schema

### Core Table: `break_sessions`

| Field | Type | Description |
|-------|------|-------------|
| `id` | serial | Primary key |
| `agent_user_id` | int | Agent taking the break (FK to agents.user_id) |
| `break_type` | enum | Morning, Lunch, Afternoon |
| `start_time` | timestamp | When break started |
| `end_time` | timestamp | When break ended (NULL if active) |
| `duration_minutes` | int | Auto-calculated duration |
| `created_at` | timestamp | Record creation time |

### ENUM Type

```sql
-- Break Types
'Morning' | 'Lunch' | 'Afternoon'
```

### Auto-Duration Calculation

The schema includes a trigger that automatically calculates `duration_minutes` when `end_time` is set:

```sql
duration_minutes = EXTRACT(EPOCH FROM (end_time - start_time)) / 60
```

## Architecture: Database + localStorage

### Historical Data (Database)
- ✅ **Completed breaks** stored in `break_sessions` table
- ✅ **Analytics and reporting** from historical data
- ✅ **Audit trail** of all break sessions

### Current Session (localStorage)
- ✅ **Active break** tracked in real-time
- ✅ **Timer functionality** without database calls
- ✅ **Performance** - no constant database updates

## Setup Instructions

### 1. Create Schema

```bash
# Run the break management migration
psql $DATABASE_URL -f migrations/005_break_management_schema.sql
```

### 2. Seed Sample Data

```bash
# Create sample historical breaks
npm run seed-breaks
```

This creates realistic break sessions for the past 7 days:
- **Morning breaks**: 10:00-11:00 AM, 10-20 minutes
- **Lunch breaks**: 12:00-2:00 PM, 30-60 minutes  
- **Afternoon breaks**: 3:00-4:00 PM, 10-25 minutes

## Usage Examples

### Starting a Break (localStorage)

```javascript
// Store current break in localStorage
const currentBreak = {
  break_type: 'lunch',
  start_time: new Date().toISOString(),
  user_id: getCurrentUser().id
};
localStorage.setItem('currentBreak', JSON.stringify(currentBreak));
```

### Ending a Break (Save to Database)

```javascript
// Get current break from localStorage
const currentBreak = JSON.parse(localStorage.getItem('currentBreak'));

// Save completed break to database
await fetch('/api/breaks', {
  method: 'POST',
  body: JSON.stringify({
    user_id: currentBreak.user_id,
    break_type: currentBreak.break_type,
    start_time: currentBreak.start_time,
    end_time: new Date().toISOString()
  })
});

// Clear localStorage
localStorage.removeItem('currentBreak');
```

### Database Queries

```sql
-- Get today's breaks for an agent
SELECT * FROM break_sessions 
WHERE agent_user_id = 1 
AND DATE(start_time) = CURRENT_DATE
ORDER BY start_time;

-- Get break statistics for the week
SELECT 
  break_type,
  COUNT(*) as total_breaks,
  ROUND(AVG(duration_minutes)) as avg_duration,
  SUM(duration_minutes) as total_minutes
FROM break_sessions 
WHERE start_time >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY break_type;

-- Check if agent is currently on break
SELECT * FROM break_sessions 
WHERE agent_user_id = 1 
AND end_time IS NULL;

-- Daily break summary
SELECT 
  DATE(start_time) as break_date,
  break_type,
  COUNT(*) as count,
  SUM(duration_minutes) as total_minutes
FROM break_sessions 
WHERE agent_user_id = 1
AND start_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(start_time), break_type
ORDER BY break_date DESC, break_type;

-- Get agent break history with personal info
SELECT 
  bs.*,
  u.email,
  pi.first_name,
  pi.last_name
FROM break_sessions bs
JOIN agents a ON bs.agent_user_id = a.user_id
JOIN users u ON a.user_id = u.id
LEFT JOIN personal_info pi ON u.id = pi.user_id
WHERE bs.agent_user_id = 1
ORDER BY bs.start_time DESC;
```

### API Integration

**Break Management API Endpoints:**

```javascript
// Start a new break session
POST /api/breaks/start
{
  "agent_user_id": 1,
  "break_type": "Lunch"  // Morning, Lunch, or Afternoon
}

// End an active break session (by agent_user_id)
POST /api/breaks/end
{
  "agent_user_id": 1
}

// End a specific break session (by break_id)
POST /api/breaks/end
{
  "break_id": 123
}

// Get break history for an agent
GET /api/breaks/history?agent_user_id=1&days=7&include_active=true

// Check current break status
GET /api/breaks/status?agent_user_id=1
```

**Example Usage in Frontend:**

```javascript
// Start break from localStorage data
const currentUser = getCurrentUser();
const startBreak = async (breakType) => {
  try {
    const response = await fetch('/api/breaks/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_user_id: currentUser.id,
        break_type: breakType  // 'Morning', 'Lunch', or 'Afternoon'
      })
    });
    
    const result = await response.json();
    if (result.success) {
      // Store active break in localStorage for real-time tracking
      localStorage.setItem('currentBreak', JSON.stringify({
        id: result.breakSession.id,
        break_type: breakType,
        start_time: result.breakSession.start_time,
        agent_user_id: currentUser.id
      }));
    }
  } catch (error) {
    console.error('Failed to start break:', error);
  }
};

// End break and clear localStorage
const endBreak = async () => {
  const currentBreak = JSON.parse(localStorage.getItem('currentBreak') || '{}');
  
  try {
    const response = await fetch('/api/breaks/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_user_id: currentBreak.agent_user_id
      })
    });
    
    const result = await response.json();
    if (result.success) {
      // Clear localStorage
      localStorage.removeItem('currentBreak');
      console.log(`Break ended: ${result.breakSession.duration_minutes} minutes`);
    }
  } catch (error) {
    console.error('Failed to end break:', error);
  }
};
```

## Break Types & Timing

### Morning Break
- **Time**: 10:00-11:00 AM
- **Duration**: 10-20 minutes
- **Purpose**: Mid-morning energy boost

### Lunch Break  
- **Time**: 12:00-2:00 PM
- **Duration**: 30-60 minutes
- **Purpose**: Meal and rest period

### Afternoon Break
- **Time**: 3:00-4:00 PM  
- **Duration**: 10-25 minutes
- **Purpose**: Afternoon refresher

## Performance Considerations

### Indexes
- `agent_user_id` - For agent-specific queries
- `break_type` - For break type filtering
- `start_time` - For date range queries  
- `DATE(start_time)` - For daily summaries
- `(agent_user_id, end_time) WHERE end_time IS NULL` - For active breaks

### localStorage Benefits
- ✅ **Real-time updates** without database load
- ✅ **Offline capability** during network issues
- ✅ **Instant response** for UI updates
- ✅ **Reduced database calls** during active breaks

## Integration with Existing App

### Current Break System
The existing break system in localStorage continues to work:
- Timer functionality remains unchanged
- Current break state managed client-side
- Only completed breaks saved to database

### Activity Tracking Integration
- Break sessions can integrate with activity tracking
- Pause activity tracking during breaks
- Resume tracking when break ends

### Reporting Integration  
- Historical break data for reports
- Break time vs productivity correlation
- Agent break pattern analysis

## Migration Strategy

### Phase 1: Add Database Schema
- ✅ Create `break_sessions` table
- ✅ Keep existing localStorage functionality
- ✅ No changes to current break UI

### Phase 2: Save Completed Breaks
- Add API call when break ends
- Save completed breaks to database
- Keep current break in localStorage

### Phase 3: Add Reporting
- Build break analytics dashboard
- Historical break viewing
- Break pattern insights

## Security Considerations

- **Agent-Only Access**: Only agents can create break sessions
- **User Ownership**: Breaks linked to agent via user_id
- **Data Validation**: Break types restricted to enum values
- **Time Validation**: Start time must be before end time

## Development Scripts

| Script | Description |
|--------|-------------|
| `npm run seed-breaks` | Create sample break sessions |
| `npm run check-db` | Verify database connection |

## Future Enhancements

The simple schema supports future additions:
- **Break Policies**: Maximum break durations
- **Notifications**: Break reminders
- **Team Breaks**: Group break coordination
- **Break Credits**: Earned break time system
- **Integration**: Calendar and meeting integration

This simple schema provides a solid foundation for break management while keeping the current real-time localStorage functionality intact. 