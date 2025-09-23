/**
 * Utility functions for handling shift-based timer resets
 * instead of calendar-day resets for night shift agents
 */

export interface ShiftInfo {
  period: string;           // "Day Shift" or "Night Shift"
  schedule: string;         // "Mon-Fri", "Sun-Thu", etc.
  time: string;            // "10:00 PM - 7:00 AM", "6:00 AM - 7:00 PM"
  startTime: Date;         // Parsed start time for current shift period
  endTime: Date;           // Parsed end time for current shift period
  isNightShift: boolean;   // True if shift crosses midnight
}

/**
 * Parse shift time string like "10:00 PM - 7:00 AM" and return start/end times
 */
export function parseShiftTime(shiftTimeString: string, referenceDate = new Date()): ShiftInfo | null {
  if (!shiftTimeString) return null;

  try {
    // Extract just the time portion, ignoring period and schedule
    const timeMatch = shiftTimeString.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    if (!timeMatch) return null;

    const [, startTimeStr, endTimeStr] = timeMatch;

    // Parse start and end times
    const today = new Date(referenceDate);
    today.setSeconds(0, 0); // Reset seconds and milliseconds

    const startTime = parseTimeString(startTimeStr, today);
    let endTime = parseTimeString(endTimeStr, today);

    // If end time is before start time, it means shift crosses midnight
    const isNightShift = endTime <= startTime;
    if (isNightShift) {
      // For night shifts, we need to determine which shift period we're in
      const now = new Date(referenceDate);
      
      // Check if we're currently before or after the end time today
      const endTimeToday = new Date(endTime);
      const startTimeToday = new Date(startTime);
      
      if (now <= endTimeToday) {
        // We're before the end time today, so we're in the shift that started yesterday
        const startTimeYesterday = new Date(startTime);
        startTimeYesterday.setDate(startTimeYesterday.getDate() - 1);
        
        return {
          period: "Night Shift",
          schedule: "",
          time: shiftTimeString,
          startTime: startTimeYesterday,
          endTime: endTimeToday,
          isNightShift
        };
      } else {
        // We're after the end time today, so we're either:
        // 1. In the shift that started today (if we're after start time)
        // 2. Between shifts (if we're before start time)
        
        if (now >= startTimeToday) {
          // We're in the shift that started today
          const endTimeTomorrow = new Date(endTime);
          endTimeTomorrow.setDate(endTimeTomorrow.getDate() + 1);
          
          return {
            period: "Night Shift",
            schedule: "",
            time: shiftTimeString,
            startTime: startTimeToday,
            endTime: endTimeTomorrow,
            isNightShift
          };
        } else {
          // We're between shifts - return the most recent completed shift
          const startTimeYesterday = new Date(startTime);
          startTimeYesterday.setDate(startTimeYesterday.getDate() - 1);
          
          return {
            period: "Night Shift",
            schedule: "",
            time: shiftTimeString,
            startTime: startTimeYesterday,
            endTime: endTimeToday,
            isNightShift
          };
        }
      }
    }

    // Day shift - simple same-day logic
    return {
      period: "Day Shift",
      schedule: "", // We don't parse schedule from time string
      time: shiftTimeString,
      startTime,
      endTime,
      isNightShift: false
    };
  } catch (error) {
    console.error('Error parsing shift time:', error);
    return null;
  }
}

/**
 * Parse time string like "10:00 PM" into a Date object for today
 */
function parseTimeString(timeStr: string, baseDate: Date): Date {
  const cleanTimeStr = timeStr.trim();
  const [time, period] = cleanTimeStr.split(/\s+/);
  const [hours, minutes] = time.split(':').map(Number);

  const result = new Date(baseDate);
  
  let hour24 = hours;
  if (period?.toUpperCase() === 'PM' && hours !== 12) {
    hour24 += 12;
  } else if (period?.toUpperCase() === 'AM' && hours === 12) {
    hour24 = 0;
  }

  result.setHours(hour24, minutes, 0, 0);
  return result;
}

/**
 * Determine if we should reset the timer based on shift schedule
 * Returns true if current time has passed the shift start time since last activity
 */
export function shouldResetForShift(
  lastActivityTime: Date,
  currentTime: Date,
  shiftInfo: ShiftInfo
): boolean {
  if (!shiftInfo) {
    // Fallback to daily reset if no shift info
    const lastDate = lastActivityTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const currentDate = currentTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    return lastDate !== currentDate;
  }

  // For night shifts, we need to check if we've crossed the shift start time
  if (shiftInfo.isNightShift) {
    // Night shift example: 10:00 PM - 7:00 AM
    // Reset happens at 10:00 PM each day
    
    const lastShiftStart = getShiftStartForDate(lastActivityTime, shiftInfo);
    const currentShiftStart = getShiftStartForDate(currentTime, shiftInfo);
    
    // Check if we've moved to a new shift period
    return currentShiftStart.getTime() !== lastShiftStart.getTime();
  } else {
    // For day shifts, reset at shift start time each day
    const lastShiftStart = getShiftStartForDate(lastActivityTime, shiftInfo);
    const currentShiftStart = getShiftStartForDate(currentTime, shiftInfo);
    
    return currentTime >= currentShiftStart && lastActivityTime < currentShiftStart;
  }
}

/**
 * Get the shift start time for a given date
 */
function getShiftStartForDate(date: Date, shiftInfo: ShiftInfo): Date {
  const shiftDate = new Date(date);
  const shiftStartTime = new Date(shiftInfo.startTime);
  const shiftEndTime = new Date(shiftInfo.endTime);
  
  // Set the date but keep the time from shift start
  shiftDate.setHours(
    shiftStartTime.getHours(),
    shiftStartTime.getMinutes(),
    0, 0
  );

  if (shiftInfo.isNightShift) {
    // For night shifts, we need to determine which shift period we're in
    // Create a temporary date with the shift start time for today
    const todayShiftStart = new Date(shiftDate);
    
    // Create a temporary date with the shift end time for today
    const todayShiftEnd = new Date(date);
    todayShiftEnd.setHours(
      shiftEndTime.getHours(),
      shiftEndTime.getMinutes(),
      0, 0
    );
    
    // For night shifts, if end time is before start time, add one day to end time
    if (todayShiftEnd <= todayShiftStart) {
      todayShiftEnd.setDate(todayShiftEnd.getDate() + 1);
    }
    
    // For night shifts, if we're before the shift start time today,
    // we're still in the shift that started yesterday
    if (date < todayShiftStart) {
      // We're in the shift that started the previous day
      shiftDate.setDate(shiftDate.getDate() - 1);
      return shiftDate;
    } else if (date <= todayShiftEnd) {
      // We're between shift start and shift end on the same day
      return shiftDate;
    } else {
      // We're after shift end, so we're in the shift that started today
      return shiftDate;
    }
  }

  return shiftDate;
}

/**
 * Get current shift period identifier for activity_data table
 * This helps us track activity per shift rather than per calendar day
 */
export function getCurrentShiftId(currentTime: Date, shiftInfo: ShiftInfo): string {
  if (!shiftInfo) {
    // Fallback to date-based ID
    return currentTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  }

  const shiftStart = getShiftStartForDate(currentTime, shiftInfo);
  
  if (shiftInfo.isNightShift) {
    // For night shifts, use the date when the shift started
    // Example: Night shift starting 10 PM on Jan 15 gets ID "2025-01-15-night"
    return shiftStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) + '-night';
  } else {
    // For day shifts, use the current date
    // Example: Day shift on Jan 15 gets ID "2025-01-15-day"  
    return currentTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }) + '-day';
  }
}

/**
 * Calculate time remaining until next reset
 * Returns the number of milliseconds until the timer will reset
 */
export function getTimeUntilReset(currentTime: Date, shiftInfo: ShiftInfo | null): number {
  if (!shiftInfo) {
    // Fallback to daily reset at midnight Philippines time
    const tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime() - currentTime.getTime();
  }

  // For both day and night shifts, reset happens at shift start time
  const nextShiftStart = getNextShiftStart(currentTime, shiftInfo);
  return nextShiftStart.getTime() - currentTime.getTime();
}

/**
 * Get the next shift start time from current time
 */
function getNextShiftStart(currentTime: Date, shiftInfo: ShiftInfo): Date {
  const shiftStartTime = new Date(shiftInfo.startTime);
  
  // Start with today's shift start time
  const todayShiftStart = new Date(currentTime);
  todayShiftStart.setHours(
    shiftStartTime.getHours(),
    shiftStartTime.getMinutes(),
    0, 0
  );

  // If we're past today's shift start time, move to tomorrow
  if (currentTime >= todayShiftStart) {
    const tomorrowShiftStart = new Date(todayShiftStart);
    tomorrowShiftStart.setDate(tomorrowShiftStart.getDate() + 1);
    return tomorrowShiftStart;
  } else {
    return todayShiftStart;
  }
}

/**
 * Format time remaining in a human-readable format
 */
export function formatTimeUntilReset(milliseconds: number): string {
  if (milliseconds <= 0) {
    return 'Resetting...';
  }

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m until reset`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s until reset`;
  } else {
    return `${seconds}s until reset`;
  }
}

/**
 * Get reset type description for display
 */
export function getResetTypeDescription(shiftInfo: ShiftInfo | null): string {
  if (!shiftInfo) {
    return 'New data at midnight';
  }
  
  const startTime = shiftInfo.startTime.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (shiftInfo.isNightShift) {
    return `New data at ${startTime}`;
  } else {
    return `New data at ${startTime}`;
  }
}

/**
 * Format shift info for logging
 */
export function formatShiftInfo(shiftInfo: ShiftInfo): string {
  if (!shiftInfo) return 'No shift info';
  
  const start = shiftInfo.startTime.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  const end = shiftInfo.endTime.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  return `${shiftInfo.period} (${start} - ${end})`;
}

/**
 * Check if the current time is before shift start time
 * Returns true if shift hasn't started yet
 */
export function isShiftNotStarted(shiftInfo: ShiftInfo | null, currentTime: Date = new Date()): boolean {
  if (!shiftInfo) return false;

  try {
    // Get current Philippines time
    const nowPH = new Date(currentTime.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    
    // Check if we have shift info from context
    if (shiftInfo?.startTime) {
      // Convert shift start time to Philippines timezone for accurate comparison
      const shiftStartDate = new Date(shiftInfo.startTime);
      const shiftStartDatePH = new Date(shiftStartDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      return nowPH < shiftStartDatePH;
    }

    // Fallback: try to parse from shift time string if available
    if (shiftInfo?.time) {
      const parsed = parseShiftTime(shiftInfo.time, nowPH);
      if (parsed?.startTime) {
        return nowPH < parsed.startTime;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking if shift not started:', error);
    return false;
  }
}

/**
 * Check if the current time is after shift end time
 * Returns true if shift has ended
 */
export function isShiftEnded(shiftInfo: ShiftInfo | null, currentTime: Date = new Date()): boolean {
  if (!shiftInfo) return false;

  try {
    // Get current Philippines time
    const nowPH = new Date(currentTime.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    
    // Check if we have shift info from context
    if (shiftInfo?.endTime) {
      // Convert shift end time to Philippines timezone for accurate comparison
      const shiftEndDate = new Date(shiftInfo.endTime);
      const shiftEndDatePH = new Date(shiftEndDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      return nowPH > shiftEndDatePH;
    }

    // Fallback: try to parse from shift time string if available
    if (shiftInfo?.time) {
      const parsed = parseShiftTime(shiftInfo.time, nowPH);
      if (parsed?.endTime) {
        return nowPH > parsed.endTime;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking if shift ended:', error);
    return false;
  }
}

/**
 * Check if the current time is within shift hours
 * Returns true if shift has started and not ended yet
 */
export function isWithinShiftHours(shiftInfo: ShiftInfo | null, currentTime: Date = new Date()): boolean {
  if (!shiftInfo) return true; // Default to true if no shift info (allow activity tracking)

  return !isShiftNotStarted(shiftInfo, currentTime) && !isShiftEnded(shiftInfo, currentTime);
}