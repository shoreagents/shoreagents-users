export interface ActivitySession {
  userId: string;
  startTime: number;
  endTime?: number;
  type: 'active' | 'inactive' | 'break';
  duration?: number;
  endReason?: 'logout' | 'inactivity' | 'break' | 'natural' | 'app-close';
}

export interface HourlyActivityData {
  hour: number; // 0-23
  date: string; // YYYY-MM-DD format
  timestamp: number; // Start of hour timestamp
  activeTime: number; // milliseconds
  inactiveTime: number; // milliseconds
  activeSessions: number; // count
  inactiveSessions: number; // count
  lastUpdated: number; // timestamp of last update
}

export interface DailyActivitySummary {
  date: string; // YYYY-MM-DD format
  totalActiveTime: number; // milliseconds
  totalInactiveTime: number; // milliseconds
  totalSessions: number;
  firstActivity: number; // timestamp
  lastActivity: number; // timestamp
  hourlyData: HourlyActivityData[];
}

export interface UserActivityData {
  userId: string;
  currentSessionStart: number;
  isCurrentlyActive: boolean;
  totalActiveTime: number;
  totalInactiveTime: number;
  inactivityAlerts: number;
  activitySessions: ActivitySession[];
  lastActivityTime: number;
  isInBreak?: boolean; // Added for break mode
  isLoggedOut?: boolean; // Added to track logout state
  lastLogoutTime?: number; // When user last logged out
  // New 24-hour rolling data
  hourlyData?: HourlyActivityData[]; // Last 24 hours of data
  dailySummaries?: DailyActivitySummary[]; // Last 30 days of daily summaries
}

export const getActivityStorageKey = (userId: string) => {
  return `shoreagents-activity-${userId}`;
};

export const getTodayDataStorageKey = (userId: string) => {
  return `shoreagents-today-${userId}`;
};

export const getYesterdayDataStorageKey = (userId: string) => {
  return `shoreagents-yesterday-${userId}`;
};

export const getWeeklyDataStorageKey = (userId: string) => {
  return `shoreagents-weekly-${userId}`;
};

export const getMonthlyTotalsStorageKey = (userId: string) => {
  return `shoreagents-monthly-totals-${userId}`;
};

// Legacy key functions for backward compatibility
export const getHourlyDataStorageKey = (userId: string) => {
  return `shoreagents-today-${userId}`;
};

export const getDailySummaryStorageKey = (userId: string) => {
  return `shoreagents-yesterday-${userId}`;
};

export interface MonthlyTotals {
  userId: string;
  totalActiveTime: number; // Total active time for the month in milliseconds
  totalInactiveTime: number; // Total inactive time for the month in milliseconds
  monthStartDate: string; // YYYY-MM-DD format (e.g., 2025-07-01)
  lastUpdated: number; // Timestamp of last update
}

export const initializeUserActivity = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  const key = getActivityStorageKey(userId);
  const existingData = localStorage.getItem(key);
  const now = Date.now();
  
  if (!existingData) {
    const initialData: UserActivityData = {
      userId,
      currentSessionStart: now,
      isCurrentlyActive: true,
      totalActiveTime: 0,
      totalInactiveTime: 0,
      inactivityAlerts: 0,
      activitySessions: [{
        userId,
        startTime: now,
        type: 'active'
      }],
      lastActivityTime: now,
      isLoggedOut: false
    };
    
    localStorage.setItem(key, JSON.stringify(initialData));
  } else {
    // If data exists, ensure clean state for new login
    const userData: UserActivityData = JSON.parse(existingData);
    
    // CLEAR LOGOUT STATE - user is logging back in
    userData.isLoggedOut = false;
    userData.lastLogoutTime = undefined;
    
    // Start fresh session for new login
    userData.isCurrentlyActive = true;
    userData.currentSessionStart = now;
    userData.lastActivityTime = now;
    
    // Ensure break mode is cleared
    if (userData.isInBreak) {
      userData.isInBreak = false;
    }
    
    // Add new active session for login
    if (!userData.activitySessions) {
      userData.activitySessions = [];
    }
    userData.activitySessions.push({
      userId,
      startTime: now,
      type: 'active'
    });
    
    // Keep only last 100 sessions to prevent localStorage from getting too large
    if (userData.activitySessions.length > 100) {
      userData.activitySessions = userData.activitySessions.slice(-100);
    }
    
    localStorage.setItem(key, JSON.stringify(userData));
  }
  
  // Start real-time session saving
  startRealTimeSaving(userId);
};

// Start automatic real-time saving of session progress
export const startRealTimeSaving = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  // Clear any existing interval
  if (realTimeSaveInterval) {
    clearInterval(realTimeSaveInterval);
  }
  
  // Save session progress every 5 seconds
  realTimeSaveInterval = setInterval(() => {
    saveCurrentSessionProgress(userId);
  }, 5000);
};

// Stop real-time saving
export const stopRealTimeSaving = () => {
  if (realTimeSaveInterval) {
    clearInterval(realTimeSaveInterval);
    realTimeSaveInterval = null;
  }
};

export const startActiveSession = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  const key = getActivityStorageKey(userId);
  const existingData = localStorage.getItem(key);
  
  if (existingData) {
    const userData: UserActivityData = JSON.parse(existingData);
    const now = Date.now();
    
    // Only start a new active session if currently inactive
    if (!userData.isCurrentlyActive) {
      // End the inactive session and calculate duration
      if (userData.currentSessionStart) {
        const inactiveDuration = now - userData.currentSessionStart;
        userData.totalInactiveTime += inactiveDuration;
        
        // Update the last inactive session with end time and duration
        const activitySessions = userData.activitySessions || [];
        const lastSession = activitySessions[activitySessions.length - 1];
        if (lastSession && lastSession.type === 'inactive' && !lastSession.endTime) {
          lastSession.endTime = now;
          lastSession.duration = inactiveDuration;
          lastSession.endReason = 'natural'; // Mark that this session ended naturally (user became active)
        }
      }
      
      // Start new active session
      userData.isCurrentlyActive = true;
      userData.currentSessionStart = now;
      userData.lastActivityTime = now;
      
      // Add new active session ONLY if not already in an active session
      if (!userData.activitySessions) {
        userData.activitySessions = [];
      }
      
      const lastSession = userData.activitySessions[userData.activitySessions.length - 1];
      const shouldCreateNewSession = !lastSession || 
                                   lastSession.type !== 'active' || 
                                   lastSession.endTime; // Only create if previous active session was completed
      
      if (shouldCreateNewSession) {
        userData.activitySessions.push({
          userId,
          startTime: now,
          type: 'active'
        });
      }
      
      // Keep only last 100 sessions to prevent localStorage from getting too large
      if (userData.activitySessions.length > 100) {
        userData.activitySessions = userData.activitySessions.slice(-100);
      }
    } else {
      // User is already active, just update last activity time
      userData.lastActivityTime = now;
    }
    
    localStorage.setItem(key, JSON.stringify(userData));
  } else {
    initializeUserActivity(userId);
  }
};

export const startInactiveSession = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  // CRITICAL: Check if user is still authenticated before starting inactive session
  const authData = localStorage.getItem("shoreagents-auth");
  if (!authData) {
    // No auth data means user logged out - don't start inactive session
    return;
  }
  
  try {
    const parsed = JSON.parse(authData);
    if (!parsed.isAuthenticated || !parsed.user || parsed.user.email !== userId) {
      // User not authenticated or different user - don't start inactive session
      return;
    }
  } catch {
    // Corrupted auth data - don't start inactive session
    return;
  }
  
  const key = getActivityStorageKey(userId);
  const existingData = localStorage.getItem(key);
  
  if (existingData) {
    const userData: UserActivityData = JSON.parse(existingData);
    const now = Date.now();
    
    // Only start inactive session if currently active (transition from active to inactive)
    if (userData.isCurrentlyActive) {
      // End the active session and calculate duration
      if (userData.currentSessionStart) {
        const activeDuration = now - userData.currentSessionStart;
        userData.totalActiveTime += activeDuration;
        
        // Record today data for the completed active session
        updateTodayActivityData(userId, 'active', activeDuration);
        
        // Update the last active session with end time and duration
        const activitySessions = userData.activitySessions || [];
        const lastSession = activitySessions[activitySessions.length - 1];
        if (lastSession && lastSession.type === 'active' && !lastSession.endTime) {
          lastSession.endTime = now;
          lastSession.duration = activeDuration;
          lastSession.endReason = 'inactivity'; // Mark that this session ended due to inactivity
        }
      }
      
      // Start new inactive session (only when dialog shows up)
      userData.isCurrentlyActive = false;
      userData.currentSessionStart = now;
      userData.inactivityAlerts++;
      
      // Add new inactive session ONLY if not already in an inactive session
      if (!userData.activitySessions) {
        userData.activitySessions = [];
      }
      
      const lastSession = userData.activitySessions[userData.activitySessions.length - 1];
      const shouldCreateNewSession = !lastSession || 
                                   lastSession.type !== 'inactive' || 
                                   lastSession.endTime; // Only create if previous inactive session was completed
      
      if (shouldCreateNewSession) {
        userData.activitySessions.push({
          userId,
          startTime: now,
          type: 'inactive'
        });
      }
      
      // Keep only last 100 sessions to prevent localStorage from getting too large
      if (userData.activitySessions.length > 100) {
        userData.activitySessions = userData.activitySessions.slice(-100);
      }
      
      localStorage.setItem(key, JSON.stringify(userData));
    } else {
      // If already inactive, do nothing (don't create duplicate inactive sessions)
    }
  }
};

// Debounced activity update to prevent excessive localStorage writes
let activityUpdateTimeout: NodeJS.Timeout | null = null;
let lastActivityUpdate = 0;

// Real-time session saving to prevent data loss
let realTimeSaveInterval: NodeJS.Timeout | null = null;
let lastRealTimeSave = 0;

export const updateLastActivity = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  // CRITICAL: Check if user is still authenticated before updating activity
  const authData = localStorage.getItem("shoreagents-auth");
  if (!authData) {
    return;
  }
  
  try {
    const parsed = JSON.parse(authData);
    if (!parsed.isAuthenticated || !parsed.user || parsed.user.email !== userId) {
      return;
    }
  } catch {
    return;
  }
  
  const now = Date.now();
  
  // Debounce updates to prevent excessive localStorage writes
  // Only update if it's been at least 50ms since last update (reduced from 100ms for faster response)
  if (now - lastActivityUpdate < 50) {
    // Clear existing timeout and set new one
    if (activityUpdateTimeout) {
      clearTimeout(activityUpdateTimeout);
    }
    
    activityUpdateTimeout = setTimeout(() => {
      updateLastActivity(userId);
    }, 50);
    return;
  }
  
  lastActivityUpdate = now;
  
  const key = getActivityStorageKey(userId);
  const existingData = localStorage.getItem(key);
  
  if (existingData) {
    const userData: UserActivityData = JSON.parse(existingData);
    
    // ADDITIONAL CHECK: If user is marked as logged out, don't update
    if (userData.isLoggedOut) {
      return;
    }
    
    // If user is in break mode, do nothing (don't start new sessions during break)
    if (userData.isInBreak) {
      return;
    }
    
    // If user is currently inactive, transition to active (mouse moved after inactivity)
    if (!userData.isCurrentlyActive) {
      // End the inactive session and calculate duration
      if (userData.currentSessionStart) {
        const inactiveDuration = now - userData.currentSessionStart;
        userData.totalInactiveTime += inactiveDuration;
        
        // Record today data for the completed inactive session
        updateTodayActivityData(userId, 'inactive', inactiveDuration);
        
        // Update the last inactive session with end time and duration
        const activitySessions = userData.activitySessions || [];
        const lastSession = activitySessions[activitySessions.length - 1];
        if (lastSession && lastSession.type === 'inactive' && !lastSession.endTime) {
          lastSession.endTime = now;
          lastSession.duration = inactiveDuration;
        }
      }
      
      // Start new active session
      userData.isCurrentlyActive = true;
      userData.currentSessionStart = now;
      userData.lastActivityTime = now;
      
      // Add new active session ONLY if the last session is not already an active session
      if (!userData.activitySessions) {
        userData.activitySessions = [];
      }
      
      const lastSession = userData.activitySessions[userData.activitySessions.length - 1];
      const shouldCreateNewSession = !lastSession || 
                                   lastSession.type !== 'active' || 
                                   lastSession.endTime; // Only create if previous active session was completed
      
      if (shouldCreateNewSession) {
        userData.activitySessions.push({
          userId,
          startTime: now,
          type: 'active'
        });
      }
      
      // Keep only last 100 sessions to prevent localStorage from getting too large
      if (userData.activitySessions.length > 100) {
        userData.activitySessions = userData.activitySessions.slice(-100);
      }
    } else {
      // User is already active, just update last activity time
      // Don't create a new session, just update the timestamp
      userData.lastActivityTime = now;
    }
    
    localStorage.setItem(key, JSON.stringify(userData));
  }
};

export const getUserActivityData = (userId: string): UserActivityData | null => {
  if (typeof window === 'undefined') return null;
  
  const key = getActivityStorageKey(userId);
  const data = localStorage.getItem(key);
  
  if (data) {
    return JSON.parse(data);
  }
  
  return null;
};

// Save current session progress to localStorage in real-time
export const saveCurrentSessionProgress = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  const now = Date.now();
  
  // Throttle real-time saves to every 5 seconds to prevent excessive writes
  if (now - lastRealTimeSave < 5000) {
    return;
  }
  
  lastRealTimeSave = now;
  
  const userData = getUserActivityData(userId);
  if (!userData || userData.isLoggedOut || userData.isInBreak) {
    return;
  }
  
  // If user has an active session, save the current progress
  if (userData.currentSessionStart && userData.currentSessionStart > 0) {
    const currentSessionDuration = now - userData.currentSessionStart;
    
    if (userData.isCurrentlyActive && currentSessionDuration > 1000) { // Only save if session is longer than 1 second
      // For active sessions, we need to be more careful to avoid double counting
      // Only save incremental progress, not the full session duration
      // The active session will be properly recorded when it ends in updateLastActivity or startInactiveSession
      
      // Don't save active session progress here - it will be saved when the session ends
      // This prevents double counting of active time and timer jumping
    } else if (!userData.isCurrentlyActive && currentSessionDuration > 1000) {
      // For inactive sessions, we need to be more careful to avoid double counting
      // Only save incremental progress, not the full session duration
      // The inactive session will be properly recorded when it ends in updateLastActivity
      
      // Don't save inactive session progress here - it will be saved when the session ends
      // This prevents double counting of inactive time
    }
  }
};

// Real-time activity tracking function
export const trackUserActivity = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  // Check for daily reset
  checkAndResetDailyData(userId);
  
  // Update activity immediately
  updateLastActivity(userId);
  
  // Save current session progress in real-time
  saveCurrentSessionProgress(userId);
  
  // Dispatch custom event for real-time updates
  const event = new CustomEvent('userActivityUpdate', {
    detail: { userId, timestamp: Date.now() }
  });
  window.dispatchEvent(event);
};

// Check and reset daily data at midnight
export const checkAndResetDailyData = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const userData = getUserActivityData(userId);
  
  if (!userData) return;
  
  // Check if we need to reset daily data (new day) - USER-SPECIFIC RESET
  const lastResetKey = `shoreagents-daily-reset-${userId}`; // User-specific reset key
  const lastResetData = localStorage.getItem(lastResetKey);
  
  let shouldReset = false;
  let lastResetDate = '';
  
  if (lastResetData) {
    try {
      // Try to parse as timestamp first (new format)
      const lastResetTimestamp = parseInt(lastResetData);
      if (!isNaN(lastResetTimestamp)) {
        lastResetDate = new Date(lastResetTimestamp).toISOString().split('T')[0];
      } else {
        // Fallback to old format (date string)
        lastResetDate = lastResetData;
      }
    } catch {
      // Invalid data, treat as no reset
      lastResetDate = '';
    }
  }
  
  if (lastResetDate !== today) {
    shouldReset = true;
  }
  
  if (shouldReset) {
    // New day - reset daily tracking with actual readable time
    const resetTime = new Date(now).toISOString();
    localStorage.setItem(lastResetKey, resetTime);
    
    // Update daily summary for the previous day if there was activity
    if (userData.lastActivityTime) {
      const lastActivityDate = new Date(userData.lastActivityTime).toISOString().split('T')[0];
      if (lastActivityDate !== today) {
        updateDailySummary(userId, lastActivityDate);
      }
    }
    
    // Reset current session if it started on a previous day
    if (userData.currentSessionStart) {
      const sessionStartDate = new Date(userData.currentSessionStart).toISOString().split('T')[0];
      if (sessionStartDate !== today) {
        // End the previous day's session and start a new one for today
        const midnight = new Date(today).getTime();
        const previousDayDuration = midnight - userData.currentSessionStart;
        
        // Record the previous day's session
        if (userData.isCurrentlyActive) {
          updateTodayActivityData(userId, 'active', previousDayDuration);
        } else {
          updateTodayActivityData(userId, 'inactive', previousDayDuration);
        }
        
        // Start new session for today
        userData.currentSessionStart = midnight;
        userData.lastActivityTime = now;
        
        // Save the updated data
        const key = getActivityStorageKey(userId);
        localStorage.setItem(key, JSON.stringify(userData));
      }
    }
    
    // DON'T clear today's data - we want to preserve daily totals
    // Instead, just ensure we start fresh for the new day
  }
};

export const getCurrentUserActivityData = (): UserActivityData | null => {
  if (typeof window === 'undefined') return null;
  
  const authData = localStorage.getItem("shoreagents-auth");
  if (!authData) return null;
  
  try {
    const parsed = JSON.parse(authData);
    const userEmail = parsed.user?.email;
    if (userEmail) {
      return getUserActivityData(userEmail);
    }
  } catch {
    return null;
  }
  
  return null;
};

export const clearUserActivityData = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  const key = getActivityStorageKey(userId);
  localStorage.removeItem(key);
};

export const cleanupDuplicateSessions = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  const key = getActivityStorageKey(userId);
  const existingData = localStorage.getItem(key);
  
  if (existingData) {
    const userData: UserActivityData = JSON.parse(existingData);
    const now = Date.now();
    
    // Clean up activity sessions - remove any incomplete sessions except the current one
    if (userData.activitySessions && userData.activitySessions.length > 0) {
      const cleanedSessions: ActivitySession[] = [];
      
      for (let i = 0; i < userData.activitySessions.length; i++) {
        const session = userData.activitySessions[i];
        
        // Keep sessions that have both start and end times (completed sessions)
        if (session.endTime && session.duration) {
          cleanedSessions.push(session);
          continue;
        }
        
        // For the last session, check if it should be the current active session
        if (i === userData.activitySessions.length - 1) {
          if (userData.isCurrentlyActive && session.type === 'active' && !session.endTime) {
            // This is the current active session, keep it
            cleanedSessions.push(session);
          } else if (!userData.isCurrentlyActive && session.type === 'inactive' && !session.endTime) {
            // This is the current inactive session, keep it
            cleanedSessions.push(session);
          } else {
            // This session doesn't match the current state, close it properly
            const sessionDuration = now - session.startTime;
            if (session.type === 'active') {
              userData.totalActiveTime += sessionDuration;
            } else if (session.type === 'inactive') {
              userData.totalInactiveTime += sessionDuration;
            }
            
            cleanedSessions.push({
              ...session,
              endTime: now,
              duration: sessionDuration
            });
            
          }
        } else {
          // For sessions that are not the last one and don't have endTime, close them
          const sessionDuration = now - session.startTime;
          if (session.type === 'active') {
            userData.totalActiveTime += sessionDuration;
          } else if (session.type === 'inactive') {
            userData.totalInactiveTime += sessionDuration;
          }
          
          cleanedSessions.push({
            ...session,
            endTime: now,
            duration: sessionDuration
          });
          
        }
      }
      
      userData.activitySessions = cleanedSessions;
      
      // Remove any duplicate consecutive sessions of the same type
      const deduplicatedSessions: ActivitySession[] = [];
      for (let i = 0; i < userData.activitySessions.length; i++) {
        const currentSession = userData.activitySessions[i];
        const lastSession = deduplicatedSessions[deduplicatedSessions.length - 1];
        
        // Only add if it's different type from the last session or if there's a time gap
        if (!lastSession || 
            lastSession.type !== currentSession.type ||
            (lastSession.endTime && Math.abs(currentSession.startTime - lastSession.endTime) > 5000)) { // 5 second gap
          deduplicatedSessions.push(currentSession);
        }
      }
      
      userData.activitySessions = deduplicatedSessions;
    }
    
    localStorage.setItem(key, JSON.stringify(userData));
  }
};

export const markUserAsLoggedOut = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  // Stop real-time saving immediately
  stopRealTimeSaving();
  
  const key = getActivityStorageKey(userId);
  const existingData = localStorage.getItem(key);
  const now = Date.now();
  
  if (existingData) {
    const userData: UserActivityData = JSON.parse(existingData);
    
    // FINAL SAVE: Save any remaining session time before logout
    if (userData.currentSessionStart && userData.currentSessionStart > 0) {
      const sessionDuration = now - userData.currentSessionStart;
      
      if (userData.isCurrentlyActive && sessionDuration > 0) {
        // Save final active session time
        userData.totalActiveTime += sessionDuration;
        updateTodayActivityData(userId, 'active', sessionDuration);
        
        // Update the last session with end time and duration
        const activitySessions = userData.activitySessions || [];
        const lastSession = activitySessions[activitySessions.length - 1];
        if (lastSession && !lastSession.endTime) {
          lastSession.endTime = now;
          lastSession.duration = sessionDuration;
          lastSession.endReason = 'logout';
        }
      } else if (!userData.isCurrentlyActive && sessionDuration > 0) {
        // Save final inactive session time
        userData.totalInactiveTime += sessionDuration;
        updateTodayActivityData(userId, 'inactive', sessionDuration);
        
        // Update the last session with end time and duration
        const activitySessions = userData.activitySessions || [];
        const lastSession = activitySessions[activitySessions.length - 1];
        if (lastSession && !lastSession.endTime) {
          lastSession.endTime = now;
          lastSession.duration = sessionDuration;
          lastSession.endReason = 'logout';
        }
      }
    }
    
    // FORCE all session states to logged out
    userData.isCurrentlyActive = false;
    userData.currentSessionStart = 0;
    userData.lastActivityTime = now;
    userData.isLoggedOut = true;
    userData.lastLogoutTime = now;
    
    // Clear break mode
    userData.isInBreak = false;
    
    localStorage.setItem(key, JSON.stringify(userData));
  }
};

export const markUserAsAppClosed = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  // Stop real-time saving immediately
  stopRealTimeSaving();
  
  const key = getActivityStorageKey(userId);
  const existingData = localStorage.getItem(key);
  
  if (existingData) {
    const userData: UserActivityData = JSON.parse(existingData);
    const now = Date.now();
    
    // FINAL SAVE: Save any remaining session time before app closes
    if (userData.currentSessionStart && userData.currentSessionStart > 0) {
      const sessionDuration = now - userData.currentSessionStart;
      
      if (userData.isCurrentlyActive && sessionDuration > 0) {
        // Save final active session time
        userData.totalActiveTime += sessionDuration;
        updateTodayActivityData(userId, 'active', sessionDuration);
      
      // Update the last active session with end time and duration
      const activitySessions = userData.activitySessions || [];
      const lastSession = activitySessions[activitySessions.length - 1];
        if (lastSession && lastSession.type === 'active' && !lastSession.endTime) {
        lastSession.endTime = now;
          lastSession.duration = sessionDuration;
          lastSession.endReason = 'app-close';
        }
      } else if (!userData.isCurrentlyActive && sessionDuration > 0) {
        // Save final inactive session time
        userData.totalInactiveTime += sessionDuration;
        updateTodayActivityData(userId, 'inactive', sessionDuration);
        
        // Update the last inactive session with end time and duration
        const activitySessions = userData.activitySessions || [];
        const lastSession = activitySessions[activitySessions.length - 1];
        if (lastSession && lastSession.type === 'inactive' && !lastSession.endTime) {
          lastSession.endTime = now;
          lastSession.duration = sessionDuration;
          lastSession.endReason = 'app-close';
        }
      }
    }
    
    // Mark user as inactive (app closed)
    userData.isCurrentlyActive = false;
    userData.currentSessionStart = 0; // Clear current session to prevent double counting
    userData.lastActivityTime = now;
    
    // Also clear break mode if active
    if (userData.isInBreak) {
      userData.isInBreak = false;
    }
    
    localStorage.setItem(key, JSON.stringify(userData));
  }
};

export const pauseActivityForBreak = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  const key = getActivityStorageKey(userId);
  const existingData = localStorage.getItem(key);
  
  if (existingData) {
    const userData: UserActivityData = JSON.parse(existingData);
    const now = Date.now();
    
    // If user is currently active, END the current session and add time to totals
    if (userData.isCurrentlyActive && userData.currentSessionStart) {
      // Calculate and add the active session duration to totals
      const currentSessionDuration = now - userData.currentSessionStart;
      userData.totalActiveTime += currentSessionDuration;
      
      // Record today and monthly data for the completed active session
      updateTodayActivityData(userId, 'active', currentSessionDuration);
      
      // Update the last active session with end time and duration
      const activitySessions = userData.activitySessions || [];
      const lastSession = activitySessions[activitySessions.length - 1];
      if (lastSession && lastSession.type === 'active' && !lastSession.endTime) {
        lastSession.endTime = now;
        lastSession.duration = currentSessionDuration;
        lastSession.endReason = 'break';
      }
      
      // Clear current session since we're pausing
      userData.currentSessionStart = 0;
    }
    
    // Mark user as in break (paused) - no active time should accumulate
    userData.isCurrentlyActive = false;
    userData.lastActivityTime = now;
    userData.isInBreak = true;
    
    // Add break session to activity sessions
    if (!userData.activitySessions) {
      userData.activitySessions = [];
    }
    userData.activitySessions.push({
      userId,
      startTime: now,
      type: 'break'
    });
    
    // Keep only last 100 sessions to prevent localStorage from getting too large
    if (userData.activitySessions.length > 100) {
      userData.activitySessions = userData.activitySessions.slice(-100);
    }
    
    localStorage.setItem(key, JSON.stringify(userData));
  }
};

export const resumeActivityFromBreak = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  const key = getActivityStorageKey(userId);
  const existingData = localStorage.getItem(key);
  
  if (existingData) {
    const userData: UserActivityData = JSON.parse(existingData);
    const now = Date.now();
    
    // End the break session first
    const activitySessions = userData.activitySessions || [];
    const lastSession = activitySessions[activitySessions.length - 1];
    if (lastSession && lastSession.type === 'break' && !lastSession.endTime) {
      lastSession.endTime = now;
      lastSession.duration = now - lastSession.startTime;
      lastSession.endReason = 'natural'; // Break ended naturally
    }
    
    // Remove break flag and start fresh active session
    userData.isInBreak = false;
    userData.isCurrentlyActive = true;
    userData.lastActivityTime = now;
    userData.currentSessionStart = now; // Start new session from current time
    
    // Add new active session (fresh start after break)
    if (!userData.activitySessions) {
      userData.activitySessions = [];
    }
    userData.activitySessions.push({
      userId,
      startTime: now,
      type: 'active'
    });
    
    // Keep only last 100 sessions to prevent localStorage from getting too large
    if (userData.activitySessions.length > 100) {
      userData.activitySessions = userData.activitySessions.slice(-100);
    }
    
    localStorage.setItem(key, JSON.stringify(userData));
  }
};

export const getActivitySummary = (userId: string) => {
  const data = getUserActivityData(userId);
  if (!data) return null;
  
  // Clean up any incomplete sessions before calculating summary
  cleanupDuplicateSessions(userId);
  
  // Re-fetch data after cleanup
  const cleanedData = getUserActivityData(userId);
  if (!cleanedData) return null;
  
  const now = Date.now();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const endOfDay = startOfDay + (24 * 60 * 60 * 1000) - 1; // 11:59:59 PM
  
  // Calculate current session duration for today only
  let currentActiveTime = 0;
  let currentInactiveTime = 0;
  
  // If in break mode, don't add any current session time (time is paused)
  if (cleanedData.isInBreak) {
    currentActiveTime = 0;
    currentInactiveTime = 0;
  } else if (cleanedData.isCurrentlyActive && 
      cleanedData.currentSessionStart && 
      cleanedData.currentSessionStart > 0) {
    // Only count time from today (12:01 AM to 11:59 PM)
    const sessionStart = Math.max(cleanedData.currentSessionStart, startOfDay);
    const sessionEnd = Math.min(now, endOfDay);
    currentActiveTime = Math.max(0, sessionEnd - sessionStart);
  } else if (!cleanedData.isCurrentlyActive && 
             cleanedData.currentSessionStart && 
             cleanedData.currentSessionStart > 0) {
    // Only count time from today (12:01 AM to 11:59 PM)
    const sessionStart = Math.max(cleanedData.currentSessionStart, startOfDay);
    const sessionEnd = Math.min(now, endOfDay);
    currentInactiveTime = Math.max(0, sessionEnd - sessionStart);
  }
  
  // Get today's sessions - handle case where activitySessions might be undefined
  const activitySessions = cleanedData.activitySessions || [];
  const todaySessions = activitySessions.filter(session => {
    // Only include sessions that started today
    const sessionStartDate = new Date(session.startTime).toISOString().split('T')[0];
    const todayDate = today.toISOString().split('T')[0];
    return sessionStartDate === todayDate;
  });
  
  const todayActiveSessions = todaySessions.filter(session => session.type === 'active' && session.duration);
  const todayInactiveSessions = todaySessions.filter(session => session.type === 'inactive' && session.duration);
  
  // Calculate today's totals from completed sessions only (within today's time window)
  const todayActiveTime = todayActiveSessions.reduce((total, session) => {
    if (!session.endTime) return total;
    
    // Only count time within today's window (12:01 AM to 11:59 PM)
    const sessionStart = Math.max(session.startTime, startOfDay);
    const sessionEnd = Math.min(session.endTime, endOfDay);
    return total + Math.max(0, sessionEnd - sessionStart);
  }, 0) + currentActiveTime;
  
  const todayInactiveTime = todayInactiveSessions.reduce((total, session) => {
    if (!session.endTime) return total;
    
    // Only count time within today's window (12:01 AM to 11:59 PM)
    const sessionStart = Math.max(session.startTime, startOfDay);
    const sessionEnd = Math.min(session.endTime, endOfDay);
    return total + Math.max(0, sessionEnd - sessionStart);
  }, 0) + currentInactiveTime;
  
  // Get monthly totals
  const monthlyKey = getMonthlyTotalsStorageKey(userId);
  const monthlyData = localStorage.getItem(monthlyKey);
  let monthlyTotals: MonthlyTotals | null = null;
  
  if (monthlyData) {
    monthlyTotals = JSON.parse(monthlyData);
    // Add current session time to monthly totals for real-time display
    if (monthlyTotals && !cleanedData.isInBreak) {
      if (cleanedData.isCurrentlyActive && currentActiveTime > 0) {
        monthlyTotals.totalActiveTime += currentActiveTime;
      } else if (!cleanedData.isCurrentlyActive && currentInactiveTime > 0) {
        monthlyTotals.totalInactiveTime += currentInactiveTime;
      }
    }
  }
  
  return {
    // Daily totals (for today only: 12:01 AM to 11:59 PM)
    todayActiveTime,
    todayInactiveTime,
    todayActiveSessions: todayActiveSessions.length,
    todayInactiveSessions: todayInactiveSessions.length,
    
    // Monthly totals (cumulative for 1 month)
    totalActiveTime: monthlyTotals?.totalActiveTime || 0,
    totalInactiveTime: monthlyTotals?.totalInactiveTime || 0,
    trackingStartDate: monthlyTotals?.monthStartDate || null,
    
    // Legacy fields for compatibility
    totalInactivityAlerts: cleanedData.inactivityAlerts || 0,
    lastActivity: new Date(cleanedData.lastActivityTime || now).toLocaleString(),
    isCurrentlyActive: cleanedData.isCurrentlyActive || false,
    isInBreak: cleanedData.isInBreak || false
  };
}; 

export const getCurrentSessionStatus = (userId: string) => {
  const data = getUserActivityData(userId);
  if (!data) return null;
  
  // If user is logged out, return no session
  if (data.isLoggedOut) {
    return {
      type: 'none',
      status: 'No Active Session',
      startTime: null,
      duration: 0,
      isActive: false
    };
  }
  
  const now = Date.now();
  
  if (data.isInBreak) {
    // During break, show no duration accumulating (time is paused)
    return {
      type: 'break',
      status: 'On Break',
      startTime: data.lastActivityTime,
      duration: 0, // No time accumulating during break
      isActive: false // Not active during break
    };
  }
  
  if (data.isCurrentlyActive && data.currentSessionStart && data.currentSessionStart > 0) {
    const duration = now - data.currentSessionStart;
    return {
      type: 'active',
      status: 'Active Session Ongoing',
      startTime: data.currentSessionStart,
      duration,
      isActive: true
    };
  }
  
  if (!data.isCurrentlyActive && data.currentSessionStart && data.currentSessionStart > 0) {
    const duration = now - data.currentSessionStart;
    return {
      type: 'inactive',
      status: 'Inactive Session',
      startTime: data.currentSessionStart,
      duration,
      isActive: false
    };
  }
  
  return {
    type: 'none',
    status: 'No Active Session',
    startTime: null,
    duration: 0,
    isActive: false
  };
}; 

export const pauseActivityForSystemSuspend = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  const key = getActivityStorageKey(userId);
  const existingData = localStorage.getItem(key);
  
  if (existingData) {
    const userData: UserActivityData = JSON.parse(existingData);
    const now = Date.now();
    
    // If user is currently active, properly end the current session
    if (userData.isCurrentlyActive && userData.currentSessionStart) {
      // Calculate current session duration so far
      const currentSessionDuration = now - userData.currentSessionStart;
      userData.totalActiveTime += currentSessionDuration;
      
      // Update the last active session with end time and duration
      const activitySessions = userData.activitySessions || [];
      const lastSession = activitySessions[activitySessions.length - 1];
      if (lastSession && lastSession.type === 'active' && !lastSession.endTime) {
        lastSession.endTime = now;
        lastSession.duration = currentSessionDuration;
      }
      
      // Clear current session completely - don't store paused session
      userData.currentSessionStart = 0;
    } else if (!userData.isCurrentlyActive && userData.currentSessionStart) {
      // If inactive, also end the inactive session
      const inactiveDuration = now - userData.currentSessionStart;
      userData.totalInactiveTime += inactiveDuration;
      
              // Record today data for the completed inactive session
        updateTodayActivityData(userId, 'inactive', inactiveDuration);
      
      const activitySessions = userData.activitySessions || [];
      const lastSession = activitySessions[activitySessions.length - 1];
      if (lastSession && lastSession.type === 'inactive' && !lastSession.endTime) {
        lastSession.endTime = now;
        lastSession.duration = inactiveDuration;
      }
      
      userData.currentSessionStart = 0;
    }
    
    // Mark user as inactive due to system suspend (don't count as inactivity alert)
    userData.isCurrentlyActive = false;
    userData.lastActivityTime = now;
    
    localStorage.setItem(key, JSON.stringify(userData));
  }
};

export const resumeActivityFromSystemSuspend = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  const key = getActivityStorageKey(userId);
  const existingData = localStorage.getItem(key);
  
  if (existingData) {
    const userData: UserActivityData = JSON.parse(existingData);
    const now = Date.now();
    
    // Resume tracking - user will need to move mouse to become active again
    // Don't automatically mark as active, let natural activity detection handle it
    // Don't start any new sessions until actual user activity is detected
    userData.lastActivityTime = now;
    userData.currentSessionStart = 0; // Ensure no ongoing session
    userData.isCurrentlyActive = false; // Ensure user starts as inactive
    
    localStorage.setItem(key, JSON.stringify(userData));
  }
};

// Update today's activity data for 24-hour rolling storage
export const updateTodayActivityData = (userId: string, activityType: 'active' | 'inactive', duration: number) => {
  if (typeof window === 'undefined') return;
  
  const now = Date.now();
  const currentDate = new Date(now);
  const dateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentHour = currentDate.getHours();
  const hourStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour).getTime();
  
  const todayKey = getTodayDataStorageKey(userId);
  const existingTodayData = localStorage.getItem(todayKey);
  
  let todayDataArray: HourlyActivityData[] = existingTodayData ? JSON.parse(existingTodayData) : [];
  
  // Find or create current hour entry
  let currentHourData = todayDataArray.find(h => h.timestamp === hourStart);
  
  if (!currentHourData) {
    currentHourData = {
      hour: currentHour,
      date: dateString,
      timestamp: hourStart,
      activeTime: 0,
      inactiveTime: 0,
      activeSessions: 0,
      inactiveSessions: 0,
      lastUpdated: now
    };
    todayDataArray.push(currentHourData);
  }
  
  // Update the current hour data
  if (activityType === 'active') {
    currentHourData.activeTime += duration;
    currentHourData.activeSessions++;
  } else {
    currentHourData.inactiveTime += duration;
    currentHourData.inactiveSessions++;
  }
  currentHourData.lastUpdated = now;
  
  // Keep only last 24 hours of data (24 * 1 hour = 24 entries max)
  const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
  todayDataArray = todayDataArray.filter(h => h.timestamp >= twentyFourHoursAgo);
  
  // Sort by timestamp
  todayDataArray.sort((a, b) => a.timestamp - b.timestamp);
  
  localStorage.setItem(todayKey, JSON.stringify(todayDataArray));
  
  // Also update yesterday summary, weekly totals, and monthly totals
  updateYesterdaySummary(userId, dateString);
  updateWeeklyTotals(userId, activityType, duration); // Updates daily data and computes totals
  updateMonthlyTotals(userId, activityType, duration); // Updates daily data and computes totals
};

// Legacy function for backward compatibility
export const updateHourlyActivityData = updateTodayActivityData;

// Update monthly totals data
export const updateMonthlyTotals = (userId: string, activityType: 'active' | 'inactive', duration: number) => {
  if (typeof window === 'undefined') return;
  
  // CRITICAL: Check if user is still authenticated before recording monthly data
  const authData = localStorage.getItem("shoreagents-auth");
  if (!authData) {
    return; // Silently block
  }
  
  try {
    const parsed = JSON.parse(authData);
    if (!parsed.isAuthenticated || !parsed.user?.email || parsed.user.email !== userId) {
      return; // Silently block
    }
  } catch (error) {
    return; // Silently block
  }
  
  // Also check if user is marked as logged out in activity data
  const userData = getUserActivityData(userId);
  if (userData?.isLoggedOut) {
    return; // Silently block
  }
  
  const now = Date.now();
  const currentDate = new Date(now);
  
  // Calculate the first day of the current month (e.g., 2025-07-01)
  // Use UTC to avoid timezone issues
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-based (0 = January, 6 = July)
  const monthStartDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const monthStartDateString = monthStartDate.toISOString().split('T')[0]; // YYYY-MM-DD
  

  
  // Calculate the first day of the next month (e.g., 2025-08-01)
  const nextMonthStartDate = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  const nextMonthStartDateString = nextMonthStartDate.toISOString().split('T')[0];
  
  const currentDateString = currentDate.toISOString().split('T')[0];
  
  const monthlyTotalsKey = getMonthlyTotalsStorageKey(userId);
  const monthlyDailyKey = `shoreagents-monthly-daily-${userId}`;
  
  // Get the daily data first
  const existingMonthlyDailyData = localStorage.getItem(monthlyDailyKey);
  
  let monthlyDailyData: {
    monthStartDate: string; // YYYY-MM-DD format
    dailyData: {
      [date: string]: {
        activeTime: number;
        inactiveTime: number;
        lastUpdated: number;
      };
    };
    lastUpdated: number;
  };
  
  if (existingMonthlyDailyData) {
    monthlyDailyData = JSON.parse(existingMonthlyDailyData);
    
    // Check if we need to start a new month OR if the monthStartDate is incorrect
    if (monthlyDailyData.monthStartDate !== monthStartDateString) {

      // New month or incorrect date - reset data
      monthlyDailyData = {
        monthStartDate: monthStartDateString,
        dailyData: {},
        lastUpdated: now
      };
    }
  } else {
    // Initialize monthly daily data
    monthlyDailyData = {
      monthStartDate: monthStartDateString,
      dailyData: {},
      lastUpdated: now
    };
  }
  
  // Only update if current date is within the current month
  const currentDateTimestamp = currentDate.getTime();
  const monthStartTimestamp = monthStartDate.getTime();
  const nextMonthStartTimestamp = nextMonthStartDate.getTime();
  
  if (currentDateTimestamp >= monthStartTimestamp && currentDateTimestamp < nextMonthStartTimestamp) {
    // Update daily data for current date
    if (!monthlyDailyData.dailyData[currentDateString]) {
      monthlyDailyData.dailyData[currentDateString] = {
        activeTime: 0,
        inactiveTime: 0,
        lastUpdated: now
      };
    }
    
    // Update daily totals
    if (activityType === 'active') {
      monthlyDailyData.dailyData[currentDateString].activeTime += duration;
    } else {
      monthlyDailyData.dailyData[currentDateString].inactiveTime += duration;
    }
    monthlyDailyData.dailyData[currentDateString].lastUpdated = now;
    monthlyDailyData.lastUpdated = now;
    
    // Save daily data
    localStorage.setItem(monthlyDailyKey, JSON.stringify(monthlyDailyData));
    
    // Now compute totals from daily data (only for current month)
    let totalActiveTime = 0;
    let totalInactiveTime = 0;
    
    // Sum up all daily data for the current month (only days within the month)
    Object.entries(monthlyDailyData.dailyData).forEach(([dateString, dayData]) => {
      const dayTimestamp = new Date(dateString).getTime();
      if (dayTimestamp >= monthStartTimestamp && dayTimestamp < nextMonthStartTimestamp) {
        totalActiveTime += dayData.activeTime;
        totalInactiveTime += dayData.inactiveTime;
      }
    });
    
    // Create or update monthly totals
    const existingMonthlyData = localStorage.getItem(monthlyTotalsKey);
    let monthlyTotals: MonthlyTotals;
    
    if (existingMonthlyData) {
      monthlyTotals = JSON.parse(existingMonthlyData);
      
      // Check if we need to start a new month
      if (monthlyTotals.monthStartDate !== monthStartDateString) {
        // New month - reset totals
        monthlyTotals = {
          userId,
          monthStartDate: monthStartDateString,
          totalActiveTime: 0,
          totalInactiveTime: 0,
          lastUpdated: now
        };
      }
    } else {
      // Initialize monthly totals
      monthlyTotals = {
        userId,
        monthStartDate: monthStartDateString,
        totalActiveTime: 0,
        totalInactiveTime: 0,
        lastUpdated: now
      };
    }
    
    // Update totals from computed values
    monthlyTotals.totalActiveTime = totalActiveTime;
    monthlyTotals.totalInactiveTime = totalInactiveTime;
    monthlyTotals.lastUpdated = now;
    
    localStorage.setItem(monthlyTotalsKey, JSON.stringify(monthlyTotals));
  }
};

// Update yesterday summary data
export const updateYesterdaySummary = (userId: string, dateString: string) => {
  if (typeof window === 'undefined') return;
  
  const yesterdayKey = getYesterdayDataStorageKey(userId);
  const existingYesterdayData = localStorage.getItem(yesterdayKey);
  
  let yesterdaySummaries: DailyActivitySummary[] = existingYesterdayData ? JSON.parse(existingYesterdayData) : [];
  
  // Get today's data for the day
  const todayKey = getTodayDataStorageKey(userId);
  const todayData: HourlyActivityData[] = JSON.parse(localStorage.getItem(todayKey) || '[]');
  const dayTodayData = todayData.filter(h => h.date === dateString);
  
  // Calculate daily totals
  const totalActiveTime = dayTodayData.reduce((sum, h) => sum + h.activeTime, 0);
  const totalInactiveTime = dayTodayData.reduce((sum, h) => sum + h.inactiveTime, 0);
  const totalSessions = dayTodayData.reduce((sum, h) => sum + h.activeSessions + h.inactiveSessions, 0);
  
  const timestamps = dayTodayData.map(h => h.timestamp).filter(t => t > 0);
  const firstActivity = timestamps.length > 0 ? Math.min(...timestamps) : 0;
  const lastActivity = timestamps.length > 0 ? Math.max(...timestamps) : 0;
  
  // Find or create yesterday summary
  let yesterdaySummary = yesterdaySummaries.find(d => d.date === dateString);
  
  if (!yesterdaySummary) {
    yesterdaySummary = {
      date: dateString,
      totalActiveTime: 0,
      totalInactiveTime: 0,
      totalSessions: 0,
      firstActivity: 0,
      lastActivity: 0,
      hourlyData: []
    };
    yesterdaySummaries.push(yesterdaySummary);
  }
  
  // Update yesterday summary
  yesterdaySummary.totalActiveTime = totalActiveTime;
  yesterdaySummary.totalInactiveTime = totalInactiveTime;
  yesterdaySummary.totalSessions = totalSessions;
  yesterdaySummary.firstActivity = firstActivity;
  yesterdaySummary.lastActivity = lastActivity;
  yesterdaySummary.hourlyData = dayTodayData;
  
  // Keep only last 30 days
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoDateString = new Date(thirtyDaysAgo).toISOString().split('T')[0];
  yesterdaySummaries = yesterdaySummaries.filter(d => d.date >= thirtyDaysAgoDateString);
  
  // Sort by date
  yesterdaySummaries.sort((a, b) => a.date.localeCompare(b.date));
  
  localStorage.setItem(yesterdayKey, JSON.stringify(yesterdaySummaries));
};

// Legacy function for backward compatibility
export const updateDailySummary = updateYesterdaySummary;

// Update weekly data storage
export const updateWeeklyData = (userId: string, dateString: string) => {
  if (typeof window === 'undefined') return;
  
  const weeklyKey = getWeeklyDataStorageKey(userId);
  const existingWeeklyData = localStorage.getItem(weeklyKey);
  
  let weeklyData: DailyActivitySummary[] = existingWeeklyData ? JSON.parse(existingWeeklyData) : [];
  
  // Get yesterday summaries for the week
  const yesterdayKey = getYesterdayDataStorageKey(userId);
  const yesterdaySummaries: DailyActivitySummary[] = JSON.parse(localStorage.getItem(yesterdayKey) || '[]');
  
  // Get the week's data (last 7 days)
  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoDate = new Date(sevenDaysAgo).toISOString().split('T')[0];
  
  const weekData = yesterdaySummaries.filter(d => d.date >= sevenDaysAgoDate);
  
  // Calculate weekly totals
  const totalActiveTime = weekData.reduce((sum, d) => sum + d.totalActiveTime, 0);
  const totalInactiveTime = weekData.reduce((sum, d) => sum + d.totalInactiveTime, 0);
  const totalSessions = weekData.reduce((sum, d) => sum + d.totalSessions, 0);
  
  const timestamps = weekData.map(d => d.firstActivity).filter(t => t > 0);
  const firstActivity = timestamps.length > 0 ? Math.min(...timestamps) : 0;
  const lastActivity = timestamps.length > 0 ? Math.max(...timestamps) : 0;
  
  // Find or create weekly summary
  let weeklySummary = weeklyData.find(w => w.date === dateString);
  
  if (!weeklySummary) {
    weeklySummary = {
      date: dateString,
      totalActiveTime: 0,
      totalInactiveTime: 0,
      totalSessions: 0,
      firstActivity: 0,
      lastActivity: 0,
      hourlyData: []
    };
    weeklyData.push(weeklySummary);
  }
  
  // Update weekly summary
  weeklySummary.totalActiveTime = totalActiveTime;
  weeklySummary.totalInactiveTime = totalInactiveTime;
  weeklySummary.totalSessions = totalSessions;
  weeklySummary.firstActivity = firstActivity;
  weeklySummary.lastActivity = lastActivity;
  weeklySummary.hourlyData = weekData.flatMap(d => d.hourlyData);
  
  // Keep only last 4 weeks
  const fourWeeksAgo = Date.now() - (4 * 7 * 24 * 60 * 60 * 1000);
  const fourWeeksAgoDateString = new Date(fourWeeksAgo).toISOString().split('T')[0];
  weeklyData = weeklyData.filter(w => w.date >= fourWeeksAgoDateString);
  
  // Sort by date
  weeklyData.sort((a, b) => a.date.localeCompare(b.date));
  
  localStorage.setItem(weeklyKey, JSON.stringify(weeklyData));
};

// Update weekly totals data (computed from daily data)
export const updateWeeklyTotals = (userId: string, activityType: 'active' | 'inactive', duration: number) => {
  if (typeof window === 'undefined') return;
  
  // CRITICAL: Check if user is still authenticated before recording weekly data
  const authData = localStorage.getItem("shoreagents-auth");
  if (!authData) {
    return; // Silently block
  }
  
  try {
    const parsed = JSON.parse(authData);
    if (!parsed.isAuthenticated || !parsed.user?.email || parsed.user.email !== userId) {
      return; // Silently block
    }
  } catch (error) {
    return; // Silently block
  }
  
  // Also check if user is marked as logged out in activity data
  const userData = getUserActivityData(userId);
  if (userData?.isLoggedOut) {
    return; // Silently block
  }
  
  const now = Date.now();
  const currentDate = new Date(now);
  const currentWeekStart = new Date(currentDate);
  currentWeekStart.setDate(currentDate.getDate() - currentDate.getDay()); // Start of week (Sunday)
  currentWeekStart.setHours(0, 0, 0, 0);
  
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + 7); // End of week (next Sunday)
  currentWeekEnd.setHours(0, 0, 0, 0);
  
  const weeklyTotalsKey = `shoreagents-weekly-totals-${userId}`;
  const weeklyDailyKey = `shoreagents-weekly-daily-${userId}`;
  
  // Get the daily data first
  const existingWeeklyDailyData = localStorage.getItem(weeklyDailyKey);
  
  let weeklyDailyData: {
    weekStartDate: string; // YYYY-MM-DD format
    dailyData: {
      [date: string]: {
        activeTime: number;
        inactiveTime: number;
        lastUpdated: number;
      };
    };
    lastUpdated: number;
  };
  
  if (existingWeeklyDailyData) {
    weeklyDailyData = JSON.parse(existingWeeklyDailyData);
    
    // Check if we need to start a new week
    const currentWeekStartString = currentWeekStart.toISOString().split('T')[0];
    if (weeklyDailyData.weekStartDate !== currentWeekStartString) {
      // New week - reset data
      weeklyDailyData = {
        weekStartDate: currentWeekStartString,
        dailyData: {},
        lastUpdated: now
      };
    }
  } else {
    // Initialize weekly daily data
    weeklyDailyData = {
      weekStartDate: currentWeekStart.toISOString().split('T')[0],
      dailyData: {},
      lastUpdated: now
    };
  }
  
  // Only update if current date is within the current week
  const currentDateString = currentDate.toISOString().split('T')[0];
  const currentDateTimestamp = currentDate.getTime();
  
  if (currentDateTimestamp >= currentWeekStart.getTime() && currentDateTimestamp < currentWeekEnd.getTime()) {
    // Update daily data for current date
    if (!weeklyDailyData.dailyData[currentDateString]) {
      weeklyDailyData.dailyData[currentDateString] = {
        activeTime: 0,
        inactiveTime: 0,
        lastUpdated: now
      };
    }
    
    // Update daily totals
    if (activityType === 'active') {
      weeklyDailyData.dailyData[currentDateString].activeTime += duration;
    } else {
      weeklyDailyData.dailyData[currentDateString].inactiveTime += duration;
    }
    weeklyDailyData.dailyData[currentDateString].lastUpdated = now;
    weeklyDailyData.lastUpdated = now;
    
    // Save daily data
    localStorage.setItem(weeklyDailyKey, JSON.stringify(weeklyDailyData));
    
    // Now compute totals from daily data (only for current week)
    let totalActiveTime = 0;
    let totalInactiveTime = 0;
    
    // Sum up all daily data for the current week (only days within the week)
    Object.entries(weeklyDailyData.dailyData).forEach(([dateString, dayData]) => {
      const dayTimestamp = new Date(dateString).getTime();
      if (dayTimestamp >= currentWeekStart.getTime() && dayTimestamp < currentWeekEnd.getTime()) {
        totalActiveTime += dayData.activeTime;
        totalInactiveTime += dayData.inactiveTime;
      }
    });
    
    // Create or update weekly totals
    const existingWeeklyTotals = localStorage.getItem(weeklyTotalsKey);
    let weeklyTotals: {
      userId: string;
      weekStartDate: string; // YYYY-MM-DD format
      totalActiveTime: number;
      totalInactiveTime: number;
      lastUpdated: number;
    };
    
    if (existingWeeklyTotals) {
      weeklyTotals = JSON.parse(existingWeeklyTotals);
      
      // Check if we need to start a new week
      const currentWeekStartString = currentWeekStart.toISOString().split('T')[0];
      if (weeklyTotals.weekStartDate !== currentWeekStartString) {
        // New week - reset totals
        weeklyTotals = {
          userId,
          weekStartDate: currentWeekStartString,
          totalActiveTime: 0,
          totalInactiveTime: 0,
          lastUpdated: now
        };
      }
    } else {
      // Initialize weekly totals
      weeklyTotals = {
        userId,
        weekStartDate: currentWeekStart.toISOString().split('T')[0],
        totalActiveTime: 0,
        totalInactiveTime: 0,
        lastUpdated: now
      };
    }
    
    // Update totals from computed values
    weeklyTotals.totalActiveTime = totalActiveTime;
    weeklyTotals.totalInactiveTime = totalInactiveTime;
    weeklyTotals.lastUpdated = now;
    
    localStorage.setItem(weeklyTotalsKey, JSON.stringify(weeklyTotals));
  }
};

// Get weekly totals summary (independent of today data)
export const getWeeklyTotalsSummary = (userId: string) => {
  if (typeof window === 'undefined') return null;
  
  const weeklyTotalsKey = `shoreagents-weekly-totals-${userId}`;
  const weeklyData = localStorage.getItem(weeklyTotalsKey);
  
  if (!weeklyData) {
    return {
      totalActiveTime: 0,
      totalInactiveTime: 0,
      weekStartDate: null
    };
  }
  
  const weeklyTotals = JSON.parse(weeklyData);
  const now = Date.now();
  
  // Add current session time if user is active (but not during break)
  const userData = getUserActivityData(userId);
  let adjustedActiveTime = weeklyTotals.totalActiveTime;
  let adjustedInactiveTime = weeklyTotals.totalInactiveTime;
  
  if (userData && !userData.isLoggedOut && !userData.isInBreak && userData.currentSessionStart > 0) {
    const currentSessionDuration = now - userData.currentSessionStart;
    
    if (userData.isCurrentlyActive) {
      adjustedActiveTime += currentSessionDuration;
    } else {
      adjustedInactiveTime += currentSessionDuration;
    }
  }
  
  return {
    totalActiveTime: adjustedActiveTime,
    totalInactiveTime: adjustedInactiveTime,
    weekStartDate: weeklyTotals.weekStartDate
  };
};

// Get today's data for different time periods
export const getTodayDataForPeriod = (userId: string, period: 'today' | '24hours' | '7days' | '30days'): HourlyActivityData[] => {
  if (typeof window === 'undefined') return [];
  
  const todayKey = getTodayDataStorageKey(userId);
  const todayData: HourlyActivityData[] = JSON.parse(localStorage.getItem(todayKey) || '[]');
  const now = Date.now();
  
  switch (period) {
    case 'today': {
      const today = new Date().toISOString().split('T')[0];
      return todayData.filter(h => h.date === today);
    }
    case '24hours': {
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
      return todayData.filter(h => h.timestamp >= twentyFourHoursAgo);
    }
    case '7days': {
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      return todayData.filter(h => h.timestamp >= sevenDaysAgo);
    }
    case '30days': {
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
      return todayData.filter(h => h.timestamp >= thirtyDaysAgo);
    }
    default:
      return todayData;
  }
};

// Legacy function for backward compatibility
export const getHourlyDataForPeriod = getTodayDataForPeriod;

// Get yesterday summaries for different time periods
export const getYesterdaySummariesForPeriod = (userId: string, period: 'today' | '24hours' | '7days' | '30days'): DailyActivitySummary[] => {
  if (typeof window === 'undefined') return [];
  
  const yesterdayKey = getYesterdayDataStorageKey(userId);
  const yesterdaySummaries: DailyActivitySummary[] = JSON.parse(localStorage.getItem(yesterdayKey) || '[]');
  const now = Date.now();
  
  switch (period) {
    case 'today': {
      const today = new Date().toISOString().split('T')[0];
      return yesterdaySummaries.filter(d => d.date === today);
    }
    case '24hours': {
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
      const twentyFourHoursAgoDate = new Date(twentyFourHoursAgo).toISOString().split('T')[0];
      return yesterdaySummaries.filter(d => d.date >= twentyFourHoursAgoDate);
    }
    case '7days': {
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const sevenDaysAgoDate = new Date(sevenDaysAgo).toISOString().split('T')[0];
      return yesterdaySummaries.filter(d => d.date >= sevenDaysAgoDate);
    }
    case '30days': {
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgoDate = new Date(thirtyDaysAgo).toISOString().split('T')[0];
      return yesterdaySummaries.filter(d => d.date >= thirtyDaysAgoDate);
    }
    default:
      return yesterdaySummaries;
  }
};

// Legacy function for backward compatibility
export const getDailySummariesForPeriod = getYesterdaySummariesForPeriod;

// Get today's activity summary for daily cards
export const getTodaysActivitySummary = (userId: string) => {
  if (typeof window === 'undefined') return null;
  
  const today = new Date().toISOString().split('T')[0];
  const now = Date.now();
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const endOfDay = startOfDay + (24 * 60 * 60 * 1000) - 1; // 11:59:59 PM
  
  // Ensure daily reset is checked
  checkAndResetDailyData(userId);
  
  // Get today's data
  const todayKey = getTodayDataStorageKey(userId);
  const todayData: HourlyActivityData[] = JSON.parse(localStorage.getItem(todayKey) || '[]');
  const todayHourlyData = todayData.filter(h => h.date === today);
  
  // Calculate today's totals from completed sessions (within today's time window)
  let todayActiveTime = todayHourlyData.reduce((sum, h) => sum + h.activeTime, 0);
  let todayInactiveTime = todayHourlyData.reduce((sum, h) => sum + h.inactiveTime, 0);
  
  // Add current session time if user is active (but not during break)
  const userData = getUserActivityData(userId);
  if (userData && !userData.isLoggedOut && !userData.isInBreak && userData.currentSessionStart > 0) {
    const sessionStartDate = new Date(userData.currentSessionStart).toISOString().split('T')[0];
    
    // Only add current session time if it started today
    if (sessionStartDate === today) {
      // Only count time from today (12:01 AM to 11:59 PM)
      const sessionStart = Math.max(userData.currentSessionStart, startOfDay);
      const sessionEnd = Math.min(now, endOfDay);
      const currentSessionDuration = Math.max(0, sessionEnd - sessionStart);
      
      if (userData.isCurrentlyActive) {
        todayActiveTime += currentSessionDuration;
      } else {
        todayInactiveTime += currentSessionDuration;
      }
    }
  }
  
  return {
    todayActiveTime,
    todayInactiveTime,
    date: today
  };
};

// Get last 24 hours activity summary
export const getLast24HoursSummary = (userId: string) => {
  if (typeof window === 'undefined') return null;
  
  const now = Date.now();
  const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
  
  // Get today's data for the last 24 hours
  const todayKey = getTodayDataStorageKey(userId);
  const todayData: HourlyActivityData[] = JSON.parse(localStorage.getItem(todayKey) || '[]');
  
  // Filter data for the last 24 hours
  const last24HoursData = todayData.filter(h => {
    const hourTimestamp = h.timestamp;
    return hourTimestamp >= twentyFourHoursAgo && hourTimestamp <= now;
  });
  
  // Calculate totals
  let activeTime = last24HoursData.reduce((sum, h) => sum + h.activeTime, 0);
  let inactiveTime = last24HoursData.reduce((sum, h) => sum + h.inactiveTime, 0);
  
  // Add current session time if active
  const userData = getUserActivityData(userId);
  if (userData && !userData.isLoggedOut && !userData.isInBreak && userData.currentSessionStart > 0) {
    const currentSessionDuration = now - userData.currentSessionStart;
    
    if (userData.isCurrentlyActive) {
      activeTime += currentSessionDuration;
    } else {
      inactiveTime += currentSessionDuration;
    }
  }
  
  return {
    activeTime,
    inactiveTime,
    period: '24hours'
  };
};

// Get last 7 days activity summary
export const getLast7DaysSummary = (userId: string) => {
  if (typeof window === 'undefined') return null;
  
  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  
  // Get yesterday summaries for the last 7 days
  const yesterdayKey = getYesterdayDataStorageKey(userId);
  const yesterdaySummaries: DailyActivitySummary[] = JSON.parse(localStorage.getItem(yesterdayKey) || '[]');
  
  // Filter data for the last 7 days
  const last7DaysData = yesterdaySummaries.filter(d => {
    const dayTimestamp = new Date(d.date).getTime();
    return dayTimestamp >= sevenDaysAgo && dayTimestamp <= now;
  });
  
  // Calculate totals
  let activeTime = last7DaysData.reduce((sum, d) => sum + d.totalActiveTime, 0);
  let inactiveTime = last7DaysData.reduce((sum, d) => sum + d.totalInactiveTime, 0);
  
  // Add current session time if active
  const userData = getUserActivityData(userId);
  if (userData && !userData.isLoggedOut && !userData.isInBreak && userData.currentSessionStart > 0) {
    const currentSessionDuration = now - userData.currentSessionStart;
    
    if (userData.isCurrentlyActive) {
      activeTime += currentSessionDuration;
    } else {
      inactiveTime += currentSessionDuration;
    }
  }
  
  return {
    activeTime,
    inactiveTime,
    period: '7days'
  };
};



// Get last 30 days activity summary
export const getLast30DaysSummary = (userId: string) => {
  if (typeof window === 'undefined') return null;
  
  const now = Date.now();
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  
  // Get yesterday summaries for the last 30 days
  const yesterdayKey = getYesterdayDataStorageKey(userId);
  const yesterdaySummaries: DailyActivitySummary[] = JSON.parse(localStorage.getItem(yesterdayKey) || '[]');
  
  // Filter data for the last 30 days
  const last30DaysData = yesterdaySummaries.filter(d => {
    const dayTimestamp = new Date(d.date).getTime();
    return dayTimestamp >= thirtyDaysAgo && dayTimestamp <= now;
  });
  
  // Calculate totals
  let activeTime = last30DaysData.reduce((sum, d) => sum + d.totalActiveTime, 0);
  let inactiveTime = last30DaysData.reduce((sum, d) => sum + d.totalInactiveTime, 0);
  
  // Add current session time if active
  const userData = getUserActivityData(userId);
  if (userData && !userData.isLoggedOut && !userData.isInBreak && userData.currentSessionStart > 0) {
    const currentSessionDuration = now - userData.currentSessionStart;
    
    if (userData.isCurrentlyActive) {
      activeTime += currentSessionDuration;
    } else {
      inactiveTime += currentSessionDuration;
    }
  }
  
  return {
    activeTime,
    inactiveTime,
    period: '30days'
  };
};

// Get monthly totals summary
export const getMonthlyTotalsSummary = (userId: string) => {
  if (typeof window === 'undefined') return null;
  
  const monthlyKey = getMonthlyTotalsStorageKey(userId);
  const monthlyData = localStorage.getItem(monthlyKey);
  
  if (!monthlyData) {
    return {
      totalActiveTime: 0,
      totalInactiveTime: 0,
      monthStartDate: null
    };
  }
  
  const monthlyTotals: MonthlyTotals = JSON.parse(monthlyData);
  const now = Date.now();
  
  // Add current session time if user is active (but not during break)
  const userData = getUserActivityData(userId);
  let adjustedActiveTime = monthlyTotals.totalActiveTime;
  let adjustedInactiveTime = monthlyTotals.totalInactiveTime;
  
  if (userData && !userData.isLoggedOut && !userData.isInBreak && userData.currentSessionStart > 0) {
    const currentSessionDuration = now - userData.currentSessionStart;
    
    if (userData.isCurrentlyActive) {
      adjustedActiveTime += currentSessionDuration;
    } else {
      adjustedInactiveTime += currentSessionDuration;
    }
  }
  
  return {
    totalActiveTime: adjustedActiveTime,
    totalInactiveTime: adjustedInactiveTime,
    monthStartDate: monthlyTotals.monthStartDate
  };
};

// Manual daily reset function for testing/debugging
export const forceDailyReset = (userId?: string) => {
  if (typeof window === 'undefined') return;
  
  if (userId) {
    // Reset for specific user
    const lastResetKey = `shoreagents-daily-reset-${userId}`;
    localStorage.removeItem(lastResetKey);
    
    // Trigger reset for this user
    checkAndResetDailyData(userId);
  } else {
    // Reset for all users (legacy behavior)
    const lastResetKey = 'shoreagents-daily-reset'; // Global reset key
    localStorage.removeItem(lastResetKey);
  }
};

// Force reset monthly data with incorrect dates
export const forceMonthlyReset = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  const monthlyTotalsKey = getMonthlyTotalsStorageKey(userId);
  const monthlyDailyKey = `shoreagents-monthly-daily-${userId}`;
  
  // Clear existing monthly data
  localStorage.removeItem(monthlyTotalsKey);
  localStorage.removeItem(monthlyDailyKey);
};

// Debug function to test date calculation
export const debugMonthCalculation = () => {
  if (typeof window === 'undefined') return;
  
  const now = Date.now();
  const currentDate = new Date(now);
  
  // Test old method
  const oldMethod = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  oldMethod.setHours(0, 0, 0, 0);
  
  // Test new UTC method
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const newMethod = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  
  // Test string-based method
  const monthString = `${year}-${String(month + 1).padStart(2, '0')}-01`;
};

// Debug function to check daily reset status
export const debugDailyReset = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const lastResetKey = `shoreagents-daily-reset-${userId}`;
  const lastResetData = localStorage.getItem(lastResetKey);
  
  // Check user activity data
  const userData = getUserActivityData(userId);
  
  // Check today's activity summary
  const summary = getActivitySummary(userId);
};

// Get next reset time (12 AM)
export const getNextResetTime = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0); // 12:00 AM
  return tomorrow;
};

// Get last reset time for debugging
export const getLastResetTime = (userId?: string) => {
  if (typeof window === 'undefined') return null;
  
  const lastResetKey = userId ? `shoreagents-daily-reset-${userId}` : 'shoreagents-daily-reset'; // User-specific or global reset key
  const lastResetData = localStorage.getItem(lastResetKey);
  
  if (!lastResetData) return null;
  
  try {
    // Try to parse as ISO string first (new format)
    const resetDate = new Date(lastResetData);
    if (!isNaN(resetDate.getTime())) {
      return resetDate;
    } else {
      // Fallback to old format (timestamp number)
      const lastResetTimestamp = parseInt(lastResetData);
      if (!isNaN(lastResetTimestamp)) {
        return new Date(lastResetTimestamp);
      }
    }
  } catch {
    return null;
  }
  
  return null;
};

// Get time until next reset
export const getTimeUntilReset = () => {
  const now = new Date();
  const nextReset = getNextResetTime();
  return nextReset.getTime() - now.getTime();
};

// Format time until reset
export const formatTimeUntilReset = (milliseconds: number) => {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

// Setup automatic daily reset at midnight
export const setupAutomaticReset = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  const scheduleReset = () => {
    const timeUntilReset = getTimeUntilReset();
    
    // Schedule reset for next midnight
    setTimeout(() => {
      checkAndResetDailyData(userId);
      
      // Schedule next reset (24 hours later)
      scheduleReset();
    }, timeUntilReset);
  };
  
  // Start the reset scheduler
  scheduleReset();
}; 

// Update weekly daily data (track individual days within the week)
export const updateWeeklyDailyData = (userId: string, activityType: 'active' | 'inactive', duration: number) => {
  if (typeof window === 'undefined') return;
  
  // CRITICAL: Check if user is still authenticated before recording weekly data
  const authData = localStorage.getItem("shoreagents-auth");
  if (!authData) {
    return; // Silently block
  }
  
  try {
    const parsed = JSON.parse(authData);
    if (!parsed.isAuthenticated || !parsed.user?.email || parsed.user.email !== userId) {
      return; // Silently block
    }
  } catch (error) {
    return; // Silently block
  }
  
  // Also check if user is marked as logged out in activity data
  const userData = getUserActivityData(userId);
  if (userData?.isLoggedOut) {
    return; // Silently block
  }
  
  const now = Date.now();
  const currentDate = new Date(now);
  const currentWeekStart = new Date(currentDate);
  currentWeekStart.setDate(currentDate.getDate() - currentDate.getDay()); // Start of week (Sunday)
  currentWeekStart.setHours(0, 0, 0, 0);
  
  const currentDateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const weekStartDateString = currentWeekStart.toISOString().split('T')[0];
  
  const weeklyDailyKey = `shoreagents-weekly-daily-${userId}`;
  const existingWeeklyDailyData = localStorage.getItem(weeklyDailyKey);
  
  let weeklyDailyData: {
    weekStartDate: string; // YYYY-MM-DD format
    dailyData: {
      [date: string]: {
        activeTime: number;
        inactiveTime: number;
        lastUpdated: number;
      };
    };
    lastUpdated: number;
  };
  
  if (existingWeeklyDailyData) {
    weeklyDailyData = JSON.parse(existingWeeklyDailyData);
    
    // Check if we need to start a new week
    if (weeklyDailyData.weekStartDate !== weekStartDateString) {
      // New week - reset data
      weeklyDailyData = {
        weekStartDate: weekStartDateString,
        dailyData: {},
        lastUpdated: now
      };
    }
  } else {
    // Initialize weekly daily data
    weeklyDailyData = {
      weekStartDate: weekStartDateString,
      dailyData: {},
      lastUpdated: now
    };
  }
  
  // Initialize or update daily data for current date
  if (!weeklyDailyData.dailyData[currentDateString]) {
    weeklyDailyData.dailyData[currentDateString] = {
      activeTime: 0,
      inactiveTime: 0,
      lastUpdated: now
    };
  }
  
  // Update daily totals
  if (activityType === 'active') {
    weeklyDailyData.dailyData[currentDateString].activeTime += duration;
  } else {
    weeklyDailyData.dailyData[currentDateString].inactiveTime += duration;
  }
  weeklyDailyData.dailyData[currentDateString].lastUpdated = now;
  weeklyDailyData.lastUpdated = now;
  
  localStorage.setItem(weeklyDailyKey, JSON.stringify(weeklyDailyData));
};

// Get weekly daily data for chart display
export const getWeeklyDailyData = (userId: string) => {
  if (typeof window === 'undefined') return null;
  
  const weeklyDailyKey = `shoreagents-weekly-daily-${userId}`;
  const weeklyDailyData = localStorage.getItem(weeklyDailyKey);
  
  if (!weeklyDailyData) {
    return {
      weekStartDate: null,
      dailyData: {}
    };
  }
  
  const data = JSON.parse(weeklyDailyData);
  
  // Add current session time if user is active
  const userData = getUserActivityData(userId);
  const now = Date.now();
  
  if (userData && !userData.isLoggedOut && !userData.isInBreak && userData.currentSessionStart > 0) {
    const currentSessionDuration = now - userData.currentSessionStart;
    const currentDateString = new Date().toISOString().split('T')[0];
    
    if (data.dailyData[currentDateString]) {
      if (userData.isCurrentlyActive) {
        data.dailyData[currentDateString].activeTime += currentSessionDuration;
      } else {
        data.dailyData[currentDateString].inactiveTime += currentSessionDuration;
      }
    }
  }
  
  return {
    weekStartDate: data.weekStartDate,
    dailyData: data.dailyData
  };
};

// Update monthly daily data (track individual days within the month)
export const updateMonthlyDailyData = (userId: string, activityType: 'active' | 'inactive', duration: number) => {
  if (typeof window === 'undefined') return;
  
  // CRITICAL: Check if user is still authenticated before recording monthly data
  const authData = localStorage.getItem("shoreagents-auth");
  if (!authData) {
    return; // Silently block
  }
  
  try {
    const parsed = JSON.parse(authData);
    if (!parsed.isAuthenticated || !parsed.user?.email || parsed.user.email !== userId) {
      return; // Silently block
    }
  } catch (error) {
    return; // Silently block
  }
  
  // Also check if user is marked as logged out in activity data
  const userData = getUserActivityData(userId);
  if (userData?.isLoggedOut) {
    return; // Silently block
  }
  
  const now = Date.now();
  const currentDate = new Date(now);
  
  // Calculate the first day of the current month (e.g., 2025-07-01)
  // Use UTC to avoid timezone issues
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-based (0 = January, 6 = July)
  const monthStartDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const monthStartDateString = monthStartDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentDateString = currentDate.toISOString().split('T')[0];
  

  
  const monthlyDailyKey = `shoreagents-monthly-daily-${userId}`;
  const existingMonthlyDailyData = localStorage.getItem(monthlyDailyKey);
  
  let monthlyDailyData: {
    monthStartDate: string; // YYYY-MM-DD format
    dailyData: {
      [date: string]: {
        activeTime: number;
        inactiveTime: number;
        lastUpdated: number;
      };
    };
    lastUpdated: number;
  };
  
  if (existingMonthlyDailyData) {
    monthlyDailyData = JSON.parse(existingMonthlyDailyData);
    
    // Check if we need to start a new month OR if the monthStartDate is incorrect
    if (monthlyDailyData.monthStartDate !== monthStartDateString) {

      // New month or incorrect date - reset data
      monthlyDailyData = {
        monthStartDate: monthStartDateString,
        dailyData: {},
        lastUpdated: now
      };
    }
  } else {
    // Initialize monthly daily data
    monthlyDailyData = {
      monthStartDate: monthStartDateString,
      dailyData: {},
      lastUpdated: now
    };
  }
  
  // Initialize or update daily data for current date
  if (!monthlyDailyData.dailyData[currentDateString]) {
    monthlyDailyData.dailyData[currentDateString] = {
      activeTime: 0,
      inactiveTime: 0,
      lastUpdated: now
    };
  }
  
  // Update daily totals
  if (activityType === 'active') {
    monthlyDailyData.dailyData[currentDateString].activeTime += duration;
  } else {
    monthlyDailyData.dailyData[currentDateString].inactiveTime += duration;
  }
  monthlyDailyData.dailyData[currentDateString].lastUpdated = now;
  monthlyDailyData.lastUpdated = now;
  
  localStorage.setItem(monthlyDailyKey, JSON.stringify(monthlyDailyData));
};

// Get monthly daily data for chart display
export const getMonthlyDailyData = (userId: string) => {
  if (typeof window === 'undefined') return null;
  
  const monthlyDailyKey = `shoreagents-monthly-daily-${userId}`;
  const monthlyDailyData = localStorage.getItem(monthlyDailyKey);
  
  if (!monthlyDailyData) {
    return {
      monthStartDate: null,
      dailyData: {}
    };
  }
  
  const data = JSON.parse(monthlyDailyData);
  
  // Add current session time if user is active
  const userData = getUserActivityData(userId);
  const now = Date.now();
  
  if (userData && !userData.isLoggedOut && !userData.isInBreak && userData.currentSessionStart > 0) {
    const currentSessionDuration = now - userData.currentSessionStart;
    const currentDateString = new Date().toISOString().split('T')[0];
    
    if (data.dailyData[currentDateString]) {
      if (userData.isCurrentlyActive) {
        data.dailyData[currentDateString].activeTime += currentSessionDuration;
      } else {
        data.dailyData[currentDateString].inactiveTime += currentSessionDuration;
      }
    }
  }
  
  return {
    monthStartDate: data.monthStartDate,
    dailyData: data.dailyData
  };
}; 

// Force save all activity data and reload page before logout
export const forceSaveAndReload = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  try {
    // Get current user data
    const userData = getUserActivityData(userId);
    if (!userData) {
      return;
    }
    
    const now = Date.now();
    
    // If user has an active session, save the current progress
    if (userData.currentSessionStart && userData.currentSessionStart > 0) {
      const currentSessionDuration = now - userData.currentSessionStart;
      
      if (userData.isCurrentlyActive && currentSessionDuration > 1000) {
        // Save current active session progress
        updateTodayActivityData(userId, 'active', currentSessionDuration);
        
        // End the active session properly
        userData.totalActiveTime += currentSessionDuration;
        
        // Update the last active session with end time and duration
        const activitySessions = userData.activitySessions || [];
        const lastSession = activitySessions[activitySessions.length - 1];
        if (lastSession && lastSession.type === 'active' && !lastSession.endTime) {
          lastSession.endTime = now;
          lastSession.duration = currentSessionDuration;
          lastSession.endReason = 'logout';
        }
        
        // Mark session as ended
        userData.isCurrentlyActive = false;
        userData.currentSessionStart = 0;
        userData.lastActivityTime = now;
        
        // Save the updated data
        const key = getActivityStorageKey(userId);
        localStorage.setItem(key, JSON.stringify(userData));
        
      } else if (!userData.isCurrentlyActive && currentSessionDuration > 1000) {
        // Save current inactive session progress
        updateTodayActivityData(userId, 'inactive', currentSessionDuration);
        
        // End the inactive session properly
        userData.totalInactiveTime += currentSessionDuration;
        
        // Update the last inactive session with end time and duration
        const activitySessions = userData.activitySessions || [];
        const lastSession = activitySessions[activitySessions.length - 1];
        if (lastSession && lastSession.type === 'inactive' && !lastSession.endTime) {
          lastSession.endTime = now;
          lastSession.duration = currentSessionDuration;
          lastSession.endReason = 'logout';
        }
        
        // Mark session as ended
        userData.currentSessionStart = 0;
        userData.lastActivityTime = now;
        
        // Save the updated data
        const key = getActivityStorageKey(userId);
        localStorage.setItem(key, JSON.stringify(userData));
      }
    }
    
    // Force save all pending data
    updateYesterdaySummary(userId, new Date().toISOString().split('T')[0]);
    updateWeeklyTotals(userId, 'active', 0); // Trigger weekly data save
    updateMonthlyTotals(userId, 'active', 0); // Trigger monthly data save
    
    // Small delay to ensure all data is saved before logout
    setTimeout(() => {
      // Clear authentication data before reload
      localStorage.removeItem("shoreagents-auth");
      document.cookie = "shoreagents-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      
      // Reload the page
      window.location.reload();
    }, 100);
    
  } catch (error) {
    console.error('Error during force save and reload:', error);
    // Still logout and reload even if there's an error
    setTimeout(() => {
      // Clear authentication data before reload
      localStorage.removeItem("shoreagents-auth");
      document.cookie = "shoreagents-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      
      // Reload the page
      window.location.reload();
    }, 100);
  }
};