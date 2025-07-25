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

export const getHourlyDataStorageKey = (userId: string) => {
  return `shoreagents-hourly-${userId}`;
};

export const getDailySummaryStorageKey = (userId: string) => {
  return `shoreagents-daily-${userId}`;
};

export const getMonthlyTotalsStorageKey = (userId: string) => {
  return `shoreagents-monthly-${userId}`;
};

export interface MonthlyTotals {
  userId: string;
  totalActiveTime: number; // Total active time for the month in milliseconds
  totalInactiveTime: number; // Total inactive time for the month in milliseconds
  startDate: string; // YYYY-MM-DD when tracking started
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
    
    // Clear any current session that might be left over
    if (userData.currentSessionStart > 0 && !userData.isCurrentlyActive) {
      userData.currentSessionStart = 0;
    }
    
    // Ensure break mode is cleared
    if (userData.isInBreak) {
      userData.isInBreak = false;
    }
    
    localStorage.setItem(key, JSON.stringify(userData));
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
        
        // Record hourly data for the completed active session
        updateHourlyActivityData(userId, 'active', activeDuration);
        
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
  // Only update if it's been at least 100ms since last update
  if (now - lastActivityUpdate < 100) {
    // Clear existing timeout and set new one
    if (activityUpdateTimeout) {
      clearTimeout(activityUpdateTimeout);
    }
    
    activityUpdateTimeout = setTimeout(() => {
      updateLastActivity(userId);
    }, 100);
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
        
        // Record hourly data for the completed inactive session
        updateHourlyActivityData(userId, 'inactive', inactiveDuration);
        
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

// Real-time activity tracking function
export const trackUserActivity = (userId: string) => {
  if (typeof window === 'undefined') return;
  
  // Update activity immediately
  updateLastActivity(userId);
  
  // Dispatch custom event for real-time updates
  const event = new CustomEvent('userActivityUpdate', {
    detail: { userId, timestamp: Date.now() }
  });
  window.dispatchEvent(event);
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
  
  const key = getActivityStorageKey(userId);
  const existingData = localStorage.getItem(key);
  const now = Date.now();
  
  if (existingData) {
    const userData: UserActivityData = JSON.parse(existingData);
    
    // ALWAYS end any current session, regardless of state
    if (userData.currentSessionStart && userData.currentSessionStart > 0) {
      const activeDuration = now - userData.currentSessionStart;
      
      // Add to total active time
      userData.totalActiveTime += activeDuration;
      
      // Record hourly and monthly data for the completed session
      updateHourlyActivityData(userId, 'active', activeDuration);
      
      // Update the last session with end time and duration
      const activitySessions = userData.activitySessions || [];
      const lastSession = activitySessions[activitySessions.length - 1];
      if (lastSession && !lastSession.endTime) {
        lastSession.endTime = now;
        lastSession.duration = activeDuration;
        lastSession.endReason = 'logout';
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
  
  const key = getActivityStorageKey(userId);
  const existingData = localStorage.getItem(key);
  
  if (existingData) {
    const userData: UserActivityData = JSON.parse(existingData);
    const now = Date.now();
    
    // If user is currently active, end their active session
    if (userData.isCurrentlyActive && userData.currentSessionStart) {
      const activeDuration = now - userData.currentSessionStart;
      userData.totalActiveTime += activeDuration;
      
      // Record hourly data for the completed active session
      updateHourlyActivityData(userId, 'active', activeDuration);
      
      // Update the last active session with end time and duration
      const activitySessions = userData.activitySessions || [];
      const lastSession = activitySessions[activitySessions.length - 1];
      if (lastSession && lastSession.type === 'active') {
        lastSession.endTime = now;
        lastSession.duration = activeDuration;
        lastSession.endReason = 'app-close'; // Mark that this session ended due to app closing
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
      
      // Record hourly and monthly data for the completed active session
      updateHourlyActivityData(userId, 'active', currentSessionDuration);
      
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
  
  // Calculate current session duration - but be more precise about timing
  let currentActiveTime = 0;
  let currentInactiveTime = 0;
  
  // Only include current session time if there's actually an active session running
  // and avoid double-counting by ensuring currentSessionStart is recent (within last hour)
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // If in break mode, don't add any current session time (time is paused)
  if (cleanedData.isInBreak) {
    // During break, no time accumulates
    currentActiveTime = 0;
    currentInactiveTime = 0;
  } else if (cleanedData.isCurrentlyActive && 
      cleanedData.currentSessionStart && 
      cleanedData.currentSessionStart > 0 &&
      cleanedData.currentSessionStart > oneHourAgo) {
    currentActiveTime = now - cleanedData.currentSessionStart;
  } else if (!cleanedData.isCurrentlyActive && 
             cleanedData.currentSessionStart && 
             cleanedData.currentSessionStart > 0 &&
             cleanedData.currentSessionStart > oneHourAgo) {
    // Only count inactive time if we're in an inactive session (dialog showed up)
    currentInactiveTime = now - cleanedData.currentSessionStart;
  }
  
  // Get today's sessions - handle case where activitySessions might be undefined
  const activitySessions = cleanedData.activitySessions || [];
  const todaySessions = activitySessions.filter(session => session.startTime >= startOfDay);
  const todayActiveSessions = todaySessions.filter(session => session.type === 'active' && session.duration);
  const todayInactiveSessions = todaySessions.filter(session => session.type === 'inactive' && session.duration);
  
  // Calculate today's totals from completed sessions only
  const todayActiveTime = todayActiveSessions.reduce((total, session) => {
    return total + (session.duration || 0);
  }, 0) + (cleanedData.isCurrentlyActive && !cleanedData.isInBreak ? currentActiveTime : 0);
  
  const todayInactiveTime = todayInactiveSessions.reduce((total, session) => {
    return total + (session.duration || 0);
  }, 0) + (!cleanedData.isCurrentlyActive && !cleanedData.isInBreak ? currentInactiveTime : 0);
  
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
    // Daily totals (reset each day)
    todayActiveTime,
    todayInactiveTime,
    todayActiveSessions: todayActiveSessions.length,
    todayInactiveSessions: todayInactiveSessions.length,
    
    // Monthly totals (cumulative for 1 month)
    totalActiveTime: monthlyTotals?.totalActiveTime || 0,
    totalInactiveTime: monthlyTotals?.totalInactiveTime || 0,
    trackingStartDate: monthlyTotals?.startDate || null,
    
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
      
      // Record hourly data for the completed inactive session
      updateHourlyActivityData(userId, 'inactive', inactiveDuration);
      
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

// Update hourly activity data for 24-hour rolling storage
export const updateHourlyActivityData = (userId: string, activityType: 'active' | 'inactive', duration: number) => {
  if (typeof window === 'undefined') return;
  
  const now = Date.now();
  const currentDate = new Date(now);
  const dateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentHour = currentDate.getHours();
  const hourStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), currentHour).getTime();
  
  const hourlyKey = getHourlyDataStorageKey(userId);
  const existingHourlyData = localStorage.getItem(hourlyKey);
  
  let hourlyDataArray: HourlyActivityData[] = existingHourlyData ? JSON.parse(existingHourlyData) : [];
  
  // Find or create current hour entry
  let currentHourData = hourlyDataArray.find(h => h.timestamp === hourStart);
  
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
    hourlyDataArray.push(currentHourData);
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
  hourlyDataArray = hourlyDataArray.filter(h => h.timestamp >= twentyFourHoursAgo);
  
  // Sort by timestamp
  hourlyDataArray.sort((a, b) => a.timestamp - b.timestamp);
  
  localStorage.setItem(hourlyKey, JSON.stringify(hourlyDataArray));
  
  // Also update daily summary and monthly totals
  updateDailySummary(userId, dateString);
  updateMonthlyTotals(userId, activityType, duration);
};

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
  const dateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const monthlyKey = getMonthlyTotalsStorageKey(userId);
  const existingMonthlyData = localStorage.getItem(monthlyKey);
  
  let monthlyTotals: MonthlyTotals;
  
  if (existingMonthlyData) {
    monthlyTotals = JSON.parse(existingMonthlyData);
  } else {
    // Initialize monthly totals with current date as start date
    monthlyTotals = {
      userId,
      totalActiveTime: 0,
      totalInactiveTime: 0,
      startDate: dateString,
      lastUpdated: now
    };
  }
  
  // Update totals
  if (activityType === 'active') {
    monthlyTotals.totalActiveTime += duration;
  } else {
    monthlyTotals.totalInactiveTime += duration;
  }
  monthlyTotals.lastUpdated = now;
  
  localStorage.setItem(monthlyKey, JSON.stringify(monthlyTotals));
};

// Update daily summary data
export const updateDailySummary = (userId: string, dateString: string) => {
  if (typeof window === 'undefined') return;
  
  const dailyKey = getDailySummaryStorageKey(userId);
  const existingDailyData = localStorage.getItem(dailyKey);
  
  let dailySummaries: DailyActivitySummary[] = existingDailyData ? JSON.parse(existingDailyData) : [];
  
  // Get hourly data for the day
  const hourlyKey = getHourlyDataStorageKey(userId);
  const hourlyData: HourlyActivityData[] = JSON.parse(localStorage.getItem(hourlyKey) || '[]');
  const dayHourlyData = hourlyData.filter(h => h.date === dateString);
  
  // Calculate daily totals
  const totalActiveTime = dayHourlyData.reduce((sum, h) => sum + h.activeTime, 0);
  const totalInactiveTime = dayHourlyData.reduce((sum, h) => sum + h.inactiveTime, 0);
  const totalSessions = dayHourlyData.reduce((sum, h) => sum + h.activeSessions + h.inactiveSessions, 0);
  
  const timestamps = dayHourlyData.map(h => h.timestamp).filter(t => t > 0);
  const firstActivity = timestamps.length > 0 ? Math.min(...timestamps) : 0;
  const lastActivity = timestamps.length > 0 ? Math.max(...timestamps) : 0;
  
  // Find or create daily summary
  let dailySummary = dailySummaries.find(d => d.date === dateString);
  
  if (!dailySummary) {
    dailySummary = {
      date: dateString,
      totalActiveTime: 0,
      totalInactiveTime: 0,
      totalSessions: 0,
      firstActivity: 0,
      lastActivity: 0,
      hourlyData: []
    };
    dailySummaries.push(dailySummary);
  }
  
  // Update daily summary
  dailySummary.totalActiveTime = totalActiveTime;
  dailySummary.totalInactiveTime = totalInactiveTime;
  dailySummary.totalSessions = totalSessions;
  dailySummary.firstActivity = firstActivity;
  dailySummary.lastActivity = lastActivity;
  dailySummary.hourlyData = dayHourlyData;
  
  // Keep only last 30 days
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgoDateString = new Date(thirtyDaysAgo).toISOString().split('T')[0];
  dailySummaries = dailySummaries.filter(d => d.date >= thirtyDaysAgoDateString);
  
  // Sort by date
  dailySummaries.sort((a, b) => a.date.localeCompare(b.date));
  
  localStorage.setItem(dailyKey, JSON.stringify(dailySummaries));
};

// Get hourly data for different time periods
export const getHourlyDataForPeriod = (userId: string, period: 'today' | '24hours' | '7days' | '30days'): HourlyActivityData[] => {
  if (typeof window === 'undefined') return [];
  
  const hourlyKey = getHourlyDataStorageKey(userId);
  const hourlyData: HourlyActivityData[] = JSON.parse(localStorage.getItem(hourlyKey) || '[]');
  const now = Date.now();
  
  switch (period) {
    case 'today': {
      const today = new Date().toISOString().split('T')[0];
      return hourlyData.filter(h => h.date === today);
    }
    case '24hours': {
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
      return hourlyData.filter(h => h.timestamp >= twentyFourHoursAgo);
    }
    case '7days': {
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      return hourlyData.filter(h => h.timestamp >= sevenDaysAgo);
    }
    case '30days': {
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
      return hourlyData.filter(h => h.timestamp >= thirtyDaysAgo);
    }
    default:
      return hourlyData;
  }
};

// Get daily summaries for different time periods
export const getDailySummariesForPeriod = (userId: string, period: 'today' | '24hours' | '7days' | '30days'): DailyActivitySummary[] => {
  if (typeof window === 'undefined') return [];
  
  const dailyKey = getDailySummaryStorageKey(userId);
  const dailySummaries: DailyActivitySummary[] = JSON.parse(localStorage.getItem(dailyKey) || '[]');
  const now = Date.now();
  
  switch (period) {
    case 'today': {
      const today = new Date().toISOString().split('T')[0];
      return dailySummaries.filter(d => d.date === today);
    }
    case '24hours': {
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
      const twentyFourHoursAgoDate = new Date(twentyFourHoursAgo).toISOString().split('T')[0];
      return dailySummaries.filter(d => d.date >= twentyFourHoursAgoDate);
    }
    case '7days': {
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const sevenDaysAgoDate = new Date(sevenDaysAgo).toISOString().split('T')[0];
      return dailySummaries.filter(d => d.date >= sevenDaysAgoDate);
    }
    case '30days': {
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgoDate = new Date(thirtyDaysAgo).toISOString().split('T')[0];
      return dailySummaries.filter(d => d.date >= thirtyDaysAgoDate);
    }
    default:
      return dailySummaries;
  }
};

// Get today's activity summary for daily cards
export const getTodaysActivitySummary = (userId: string) => {
  if (typeof window === 'undefined') return null;
  
  const today = new Date().toISOString().split('T')[0];
  const now = Date.now();
  
  // Get today's hourly data
  const hourlyKey = getHourlyDataStorageKey(userId);
  const hourlyData: HourlyActivityData[] = JSON.parse(localStorage.getItem(hourlyKey) || '[]');
  const todayHourlyData = hourlyData.filter(h => h.date === today);
  
  // Calculate today's totals from completed sessions
  let todayActiveTime = todayHourlyData.reduce((sum, h) => sum + h.activeTime, 0);
  let todayInactiveTime = todayHourlyData.reduce((sum, h) => sum + h.inactiveTime, 0);
  
  // Add current session time if user is active (but not during break)
  const userData = getUserActivityData(userId);
  if (userData && !userData.isLoggedOut && !userData.isInBreak && userData.currentSessionStart > 0) {
    const currentSessionDuration = now - userData.currentSessionStart;
    
    if (userData.isCurrentlyActive) {
      todayActiveTime += currentSessionDuration;
    } else {
      todayInactiveTime += currentSessionDuration;
    }
  }
  
  return {
    todayActiveTime,
    todayInactiveTime,
    date: today
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
      startDate: null
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
    startDate: monthlyTotals.startDate
  };
}; 