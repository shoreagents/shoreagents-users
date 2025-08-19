# Break Notification Timing System

## Overview
The break notification system provides agents with timely reminders about their available breaks, when they're about to expire, and final warnings before they miss their break opportunity.

## Break Availability Windows

### Current Implementation
- **Morning Break**: 2-hour availability window
- **Lunch Break**: 2.5-hour availability window  
- **Afternoon Break**: 2-hour availability window

### Example: Afternoon Break (from UI)
- **Valid Time**: 12:45 PM - 2:45 PM
- **Duration**: 15 minutes (actual break time)
- **Availability**: 2 hours (120 minutes)

## Notification Schedule

### 1. Break Available Notification
**When**: Right when the break becomes available
**Message**: `"Afternoon Break is now available! You can take your 15-minute break."`
**Example**: At 12:45 PM for Afternoon Break

### 2. Break Expiring Soon Notification  
**When**: 15 minutes before the break window expires
**Message**: `"⚠️ Afternoon Break expires in 15 minutes! Take your break now or you'll miss it today."`
**Example**: At 2:30 PM for Afternoon Break (15 minutes before 2:45 PM)

### 3. Final Warning Notification
**When**: 5 minutes before expiration
**Message**: `"🚨 Afternoon Break expires in 5 minutes! This is your last chance to take it today."`
**Example**: At 2:40 PM for Afternoon Break (5 minutes before 2:45 PM)

## Notification Timing Logic

### Current Time Analysis
The system continuously monitors:
- **Is Available**: Is the break currently within its valid time window?
- **Is Expiring Soon**: Is the break within 15 minutes of expiring?
- **Is Final Warning**: Is the break within 5 minutes of expiring?
- **Time Until Expiry**: How many minutes until the break window closes?

### Notification Triggers
```typescript
// Break becomes available
if (isAvailable && !isExpiringSoon && !isFinalWarning) {
  sendNotification('available');
  scheduleNextNotification(expiry - 15); // Schedule expiry warning
}

// Break is expiring soon (15 minutes or less)
if (isExpiringSoon && !isFinalWarning) {
  sendNotification('expiring_soon');
  scheduleNextNotification(expiry - 5); // Schedule final warning
}

// Break is in final warning (5 minutes or less)
if (isFinalWarning) {
  sendNotification('final_warning');
}
```

## Real-World Example: Afternoon Break

### Timeline
```
12:45 PM - Break becomes available
         ↓
         [2 hours of availability]
         ↓
2:30 PM  - "Expires in 15 minutes" warning
         ↓
         [15 minutes remaining]
         ↓
2:40 PM  - "Expires in 5 minutes" final warning
         ↓
         [5 minutes remaining]
         ↓
2:45 PM  - Break window expires
```

### Notification Messages
1. **12:45 PM**: "Afternoon Break is now available! You can take your 15-minute break."
2. **2:30 PM**: "⚠️ Afternoon Break expires in 15 minutes! Take your break now or you'll miss it today."
3. **2:40 PM**: "🚨 Afternoon Break expires in 5 minutes! This is your last chance to take it today."

## Benefits

### For Agents
- **Clear visibility** of when breaks are available
- **Advance warning** before missing break opportunities
- **Multiple reminders** to ensure breaks aren't forgotten
- **Real-time status** of break availability

### For Management
- **Compliance tracking** of break usage
- **Productivity optimization** through proper break scheduling
- **Reduced stress** for agents with clear break expectations
- **Automated reminders** reduce manual oversight needs

## Technical Implementation

### Key Functions
- `getBreakNotificationTiming()` - Analyzes current break status
- `getBreakNotificationMessage()` - Generates appropriate notification text
- `isBreakTimeValid()` - Checks if break is currently available
- `isBreakActive()` - Checks if break is currently being taken

### Notification Types
- **available**: Break just became available
- **expiring_soon**: Break expires in 15 minutes or less
- **final_warning**: Break expires in 5 minutes or less

## Future Enhancements

### Potential Improvements
1. **Customizable timing** for different notification thresholds
2. **Break usage analytics** to optimize timing
3. **Integration** with calendar systems
4. **Mobile push notifications** for remote workers
5. **Break reminder preferences** per agent

### Advanced Features
- **Break overlap detection** for team coordination
- **Break quality metrics** (duration, frequency)
- **Automated break scheduling** based on workload
- **Break compliance reporting** for management

## Conclusion

The break notification timing system ensures agents never miss their break opportunities while providing management with visibility into break compliance. The three-tier notification approach (available → expiring soon → final warning) gives agents multiple chances to take their breaks within the generous availability windows.
