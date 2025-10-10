import { useState, useEffect, useCallback, useRef } from 'react';
import { getCurrentUser } from '@/lib/ticket-utils';
import { useBreak } from '@/contexts/break-context';
import { useMeeting } from '@/contexts/meeting-context';
import { useEventsContext } from '@/contexts/events-context';
import { useHealth } from '@/contexts/health-context';
import { useRestroom } from '@/contexts/restroom-context';

// Function to record system events in the database
const recordSystemEvent = async (eventType: 'suspend' | 'resume' | 'lock' | 'unlock', metadata?: any) => {
  try {
    // Use a persistent session ID that doesn't change for the user
    // This ensures all events always update the same row for the current user
    const currentUser = getCurrentUser();
    const sessionKey = `currentSystemSessionId_${currentUser?.email || 'default'}`;
    
    let sessionId = localStorage.getItem(sessionKey);
    
    // Always check if we need to update the session ID based on current date
    const now = new Date();
    // Get Manila time properly by using toLocaleDateString with Manila timezone
    const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); // YYYY-MM-DD format
    const expectedSessionId = `system_${currentUser?.email?.replace('@', '_').replace('.', '_') || 'user'}_${today}`;
    
    if (!sessionId || !sessionId.includes(today)) {
      // Create new session ID if none exists or if date has changed
      sessionId = expectedSessionId;
      localStorage.setItem(sessionKey, sessionId);
    }
    
    const response = await fetch('/api/system-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventType,
        sessionId,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to record system event:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error recording system event:', error);
    throw error;
  }
};

interface ActivityData {
  timestamp: number;
  position: { x: number; y: number };
  systemSuspended?: boolean;
  screenLocked?: boolean;
}

interface InactivityAlert {
  inactiveTime: number;
  threshold: number;
}

interface ActivityStatus {
  lastActivityTime: number;
  isTracking: boolean;
  mousePosition: { x: number; y: number };
  timeSinceLastActivity: number;
}

export const useActivityTracking = (setActivityState?: (isActive: boolean, isSystemEvent?: boolean) => void) => {
  const [isTracking, setIsTracking] = useState(false);
  const [lastActivity, setLastActivity] = useState<ActivityData | null>(null);
  const [showInactivityDialog, setShowInactivityDialog] = useState(false);
  const [inactivityData, setInactivityData] = useState<InactivityAlert | null>(null);
  const [activityStatus, setActivityStatus] = useState<ActivityStatus | null>(null);
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  
  // Get status contexts to check for conditions that should prevent inactivity alerts
  const { isBreakActive } = useBreak();
  const { isInMeeting } = useMeeting();
  const { isInEvent } = useEventsContext();
  const { isGoingToClinic, isInClinic } = useHealth();
  const { isInRestroom } = useRestroom();
  
  // Ref to track if we should prevent inactivity alerts
  const preventInactivityRef = useRef(false);
  
  // Ref to track if listeners are already set up for this instance
  const listenersSetupRef = useRef(false);
  
  // Ref for debouncing inactivity alerts
  const inactivityAlertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update preventInactivityRef based on status conditions
  useEffect(() => {
    const shouldPreventInactivity = isBreakActive || isInMeeting || isInEvent || isGoingToClinic || isInClinic || isInRestroom;
    preventInactivityRef.current = shouldPreventInactivity;
    
    // If any status becomes active and dialog is open, close it immediately
    if (shouldPreventInactivity && showInactivityDialog) {
      // REMOVED: setShowInactivityDialog(false); - Dialog should only close when user clicks button
      // REMOVED: setInactivityData(null); - Keep inactivity data until dialog is manually closed
    }
    
    // If any status becomes active, cancel any pending inactivity alerts
    if (shouldPreventInactivity && inactivityAlertTimeoutRef.current) {
      clearTimeout(inactivityAlertTimeoutRef.current);
      inactivityAlertTimeoutRef.current = null;
    }
  }, [isBreakActive, isInMeeting, isInEvent, isGoingToClinic, isInClinic, isInRestroom, showInactivityDialog]);
  
  // Periodic status check to sync React state with actual tracker state
  useEffect(() => {
    if (!window.electronAPI) return;
    
    const checkStatus = async () => {
      try {
        const status = await window.electronAPI?.activityTracking.getStatus();
        if (status && !status.error && status.isTracking !== isTracking) {
          setIsTracking(status.isTracking);
        }
      } catch (error) {
        console.error('Error checking activity status:', error);
      }
    };
    
    // Check status every 5 seconds
    const interval = setInterval(checkStatus, 5000);
    
    return () => clearInterval(interval);
  }, [isTracking]);

  // Start activity tracking
  const startTracking = useCallback(async () => {
    if (!window.electronAPI) {
      console.warn('electronAPI not available - running in browser mode');
      return;
    }
    
    
    try {
      const result = await window.electronAPI.activityTracking.start();
      if (result.success) {
        setIsTracking(true);
      } else {
        console.error('Failed to start activity tracking:', result.error);
        setIsTracking(false);
      }
    } catch (error) {
      console.error('Error starting activity tracking:', error);
      setIsTracking(false);
    }
  }, []);

  // Stop activity tracking
  const stopTracking = useCallback(async () => {
    if (!window.electronAPI) {
      console.warn('electronAPI not available - running in browser mode');
      return;
    }
    
    try {
      const result = await window.electronAPI.activityTracking.stop();
      
      if (result && result.success) {
        setIsTracking(false);
        // Activity tracking stopped successfully;
      } else {
        console.error('Failed to stop activity tracking:', result?.error || 'Unknown error');
        // Force set tracking to false even if Electron call failed
        setIsTracking(false);
      }
    } catch (error) {
      console.error('Error stopping activity tracking:', error);
      // Force set tracking to false even if there was an error
      setIsTracking(false);
    }
  }, []);

  // Pause activity tracking
  const pauseTracking = useCallback(async () => {
    if (!window.electronAPI) {
      console.warn('electronAPI not available - running in browser mode');
      return;
    }
    
    
    try {
      const result = await window.electronAPI.activityTracking.pause();
      if (result.success) {
        setIsTracking(false);
      } else {
        console.error('Failed to pause activity tracking:', result.error);
      }
    } catch (error) {
      console.error('Error pausing activity tracking:', error);
    }
  }, []);

  // Resume activity tracking
  const resumeTracking = useCallback(async () => {
    if (!window.electronAPI) {
      console.warn('electronAPI not available - running in browser mode');
      return;
    }
    
    
    try {
      const result = await window.electronAPI.activityTracking.resume();
      if (result.success) {
        setIsTracking(true);
      } else {
        console.error('Failed to resume activity tracking:', result.error);
      }
    } catch (error) {
      console.error('Error resuming activity tracking:', error);
    }
  }, []);

  // Reset activity functionality removed to prevent cheating
  // Activity will naturally reset when user becomes active

  // Set inactivity threshold
  const setInactivityThreshold = useCallback(async (threshold: number) => {
    if (!window.electronAPI) {
      console.warn('electronAPI not available - running in browser mode');
      return;
    }
    
    try {
      const result = await window.electronAPI.activityTracking.setThreshold(threshold);
      if (result.success) {
        // Threshold set successfully
      } else {
        console.error('Failed to set inactivity threshold:', result.error);
      }
    } catch (error) {
      console.error('Error setting inactivity threshold:', error);
    }
  }, []);

  // Get activity status
  const getActivityStatus = useCallback(async () => {
    if (!window.electronAPI) {
      console.warn('electronAPI not available - running in browser mode');
      return;
    }
    
    try {
      const status = await window.electronAPI.activityTracking.getStatus();
      if (status && !status.error) {
        setActivityStatus(status);
        // Sync the isTracking state with the actual tracker state
        if (status.isTracking !== isTracking) {
          setIsTracking(status.isTracking);
        }
        return status;
      } else {
        console.error('Failed to get activity status:', status.error);
      }
    } catch (error) {
      console.error('Error getting activity status:', error);
    }
  }, [isTracking]);

  // Handle activity updates
  const handleActivityUpdate = useCallback((data: unknown) => {
    const activityData = data as ActivityData;
    
    // Update screen lock status
    if (activityData.screenLocked !== undefined) {
      setIsScreenLocked(activityData.screenLocked);
    }
    
    // Don't process activity updates if system is suspended
    if (activityData.systemSuspended) {
      return;
    }
    
    // CRITICAL: Always check authentication before processing ANY activity
    const currentUser = getCurrentUser();
    const authData = localStorage.getItem("shoreagents-auth");
    if (!currentUser || !authData) {
      // User not authenticated - STOP tracking immediately
      if (isTracking) {
        stopTracking().catch(console.error);
      }
      return;
    }
    
    // Verify auth data is valid
    try {
      const parsed = JSON.parse(authData);
      if (!parsed.isAuthenticated || !parsed.user) {
        // Invalid auth - stop tracking
        if (isTracking) {
          stopTracking().catch(console.error);
        }
        return;
      }
    } catch {
      // Corrupted auth data - stop tracking
      if (isTracking) {
        stopTracking().catch(console.error);
      }
      return;
    }
    
    setLastActivity(activityData);
    // REMOVED: setShowInactivityDialog(false); - Dialog should only close when user clicks button
    // REMOVED: setInactivityData(null); - Keep inactivity data until dialog is manually closed
    
    // CRITICAL: Set activity state to active when activity is detected
    if (setActivityState) {
      setActivityState(true);
    }
    
    // Only update last activity time, don't start new sessions on every movement
    // TODO: Replace with database-driven activity update
    // updateLastActivity(currentUser.email);
  }, [isTracking, stopTracking, setActivityState]);

  // Handle inactivity alerts
  const handleInactivityAlert = useCallback((data: unknown) => {
    // CRITICAL: Always check authentication before processing inactivity
    const currentUser = getCurrentUser();
    const authData = localStorage.getItem("shoreagents-auth");
    if (!currentUser || !authData) {
      // User not authenticated - STOP tracking immediately
      if (isTracking) {
        stopTracking().catch(console.error);
      }
      return;
    }
    
    // Verify auth data is valid
    try {
      const parsed = JSON.parse(authData);
      if (!parsed.isAuthenticated || !parsed.user) {
        // Invalid auth - stop tracking
        if (isTracking) {
          stopTracking().catch(console.error);
        }
        return;
      }
    } catch {
      // Corrupted auth data - stop tracking
      if (isTracking) {
        stopTracking().catch(console.error);
      }
      return;
    }
    
    // Check if any status is active that should prevent inactivity alerts
    // Use both current state and ref for maximum reliability
    // Note: Screen lock should NOT prevent inactivity alerts - user is still inactive
    const shouldPreventInactivity = isBreakActive || isInMeeting || isInEvent || isGoingToClinic || isInClinic || isInRestroom || preventInactivityRef.current;
    
    if (shouldPreventInactivity) {
      return; // Don't show inactivity dialog when in any of these statuses
    }
    
    // Clear any existing timeout
    if (inactivityAlertTimeoutRef.current) {
      clearTimeout(inactivityAlertTimeoutRef.current);
    }
    
    // Add a small delay to prevent flashing when status changes rapidly
    inactivityAlertTimeoutRef.current = setTimeout(() => {
      // Double-check status conditions after delay
      const stillShouldPrevent = isBreakActive || isInMeeting || isInEvent || isGoingToClinic || isInClinic || isInRestroom || preventInactivityRef.current;
      
      if (stillShouldPrevent) {
        return;
      }
      
      const alertData = data as InactivityAlert;
      setInactivityData(alertData);
      setShowInactivityDialog(true);
      
      // CRITICAL: Set activity state to inactive when inactivity is detected
      if (setActivityState) {
        setActivityState(false);
      }
    }, 100); // 100ms delay to prevent flashing
    
    // Start inactive session when inactivity is detected
    // TODO: Replace with database-driven inactive session
    // startInactiveSession(currentUser.email);
  }, [isTracking, stopTracking, setActivityState, isBreakActive, isInMeeting, isInEvent, isGoingToClinic, isInClinic, isInRestroom]);

  // Handle activity reset
  const handleActivityReset = useCallback((data: unknown) => {
    // Don't process activity reset if user is not authenticated
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return;
    }
    
    const resetData = data as { timestamp: number };
    setLastActivity({ timestamp: resetData.timestamp, position: { x: 0, y: 0 } });
    // REMOVED: setShowInactivityDialog(false); - Dialog should only close when user clicks button
    // REMOVED: setInactivityData(null); - Keep inactivity data until dialog is manually closed
    
    // CRITICAL: Set activity state to active when activity is reset
    if (setActivityState) {
      setActivityState(true);
    }
    
    // Just update last activity time when activity is reset
    // TODO: Replace with database-driven activity update
    // updateLastActivity(currentUser.email);
  }, [setActivityState]);

  // Handle system suspend events
  const handleSystemSuspend = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      // Record the suspend event in database
      try {
        await recordSystemEvent('suspend', {
          reason: 'system_suspend',
          userEmail: currentUser.email,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Failed to record system suspend event:', error);
      }
    }
    
    // CRITICAL: Pause activity timer immediately when system is suspended
    if (setActivityState) {
      setActivityState(false, true); // true = isSystemEvent  
    }
    
    // REMOVED: setShowInactivityDialog(false); - Dialog should only close when user clicks button
  }, [setActivityState]);

  // Handle system resume events
  const handleSystemResume = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      // Record the resume event in database
      try {
        await recordSystemEvent('resume', {
          reason: 'system_resume',
          userEmail: currentUser.email,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Failed to record system resume event:', error);
      }
    }
    
    // CRITICAL: Resume activity timer when system resumes
    if (setActivityState) {
      setActivityState(true, true); // true = isSystemEvent
    }
  }, [setActivityState]);

  // Handle system lock events
  const handleSystemLock = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      // Record the lock event in database
      try {
        await recordSystemEvent('lock', {
          reason: 'system_lock',
          userEmail: currentUser.email,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Failed to record system lock event:', error);
      }
    }
    
    // Update screen lock state
    setIsScreenLocked(true);
    
    // CRITICAL: Set activity state to inactive when system is locked
    if (setActivityState) {
      setActivityState(false, true); // true = isSystemEvent
    }
    
    // Don't immediately trigger inactivity alert - let the normal inactivity detection work
    // The inactivity detection should continue working when screen is locked
    
  }, [setActivityState]);

  // Handle system unlock events
  const handleSystemUnlock = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      // Record the unlock event in database
      try {
        await recordSystemEvent('unlock', {
          reason: 'system_unlock',
          userEmail: currentUser.email,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Failed to record system unlock event:', error);
      }
    }
    
    // Update screen lock state
    setIsScreenLocked(false);
    
    // CRITICAL: Resume activity timer when system is unlocked
    if (setActivityState) {
      setActivityState(true, true); // true = isSystemEvent
    }
  }, [setActivityState]);

  // Update inactive time dynamically when dialog is shown
  useEffect(() => {
    if (showInactivityDialog && inactivityData) {
      const interval = setInterval(() => {
        setInactivityData(prev => {
          if (prev) {
            return {
              ...prev,
              inactiveTime: prev.inactiveTime + 1000 // Add 1 second
            };
          }
          return prev;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [showInactivityDialog, inactivityData]);

  // Set up event listeners with proper cleanup
  useEffect(() => {
    // Check if electronAPI is available
    if (!window.electronAPI) {
      console.warn('electronAPI not available - running in browser mode');
      return;
    }

    // Only initialize listeners once per instance
    if (!listenersSetupRef.current) {
      // Listen for activity updates
      window.electronAPI.receive('activity-update', handleActivityUpdate);
      
      // Listen for inactivity alerts
      window.electronAPI.receive('inactivity-alert', handleInactivityAlert);
      
      // Listen for activity resets
      window.electronAPI.receive('activity-reset', handleActivityReset);
      
      // Listen for system suspend/resume events
      window.electronAPI.receive('system-suspend', handleSystemSuspend);
      window.electronAPI.receive('system-resume', handleSystemResume);
      window.electronAPI.receive('system-lock', handleSystemLock);
      window.electronAPI.receive('system-unlock', handleSystemUnlock);

      listenersSetupRef.current = true;
    }

    // Handle shift reset events to restart inactivity detection
    const handleShiftReset = (event: CustomEvent) => {
      const { isActive: shouldBeActive } = event.detail
      
      console.log('Shift reset detected in activity tracking hook:', { shouldBeActive })
      
      // REMOVED: Reset inactivity dialog state when shift resets - Dialog should only close when user clicks button
      // REMOVED: setShowInactivityDialog(false)
      // REMOVED: setInactivityData(null)
      
      // Clear any pending inactivity alerts
      if (inactivityAlertTimeoutRef.current) {
        clearTimeout(inactivityAlertTimeoutRef.current)
        inactivityAlertTimeoutRef.current = null
      }
      
      // Reset last activity to current time to prevent immediate inactivity
      setLastActivity({ timestamp: Date.now(), position: { x: 0, y: 0 } })
      
      // If user should be active, ensure activity state is set correctly
      if (shouldBeActive && setActivityState) {
        setActivityState(true)
      }
    }

    // Listen for shift reset events
    window.addEventListener('shift-reset-detected', handleShiftReset as EventListener)

    // Cleanup listeners on unmount
    return () => {
      // Clear any pending inactivity alert timeout
      if (inactivityAlertTimeoutRef.current) {
        clearTimeout(inactivityAlertTimeoutRef.current);
        inactivityAlertTimeoutRef.current = null;
      }
      
      // Remove shift reset listener
      window.removeEventListener('shift-reset-detected', handleShiftReset as EventListener)
      
      if (window.electronAPI && listenersSetupRef.current) {
        // Use removeAllListeners as a fallback since removeListener might not exist
        try {
          if (typeof window.electronAPI.removeAllListeners === 'function') {
            window.electronAPI.removeAllListeners('activity-update');
            window.electronAPI.removeAllListeners('inactivity-alert');
            window.electronAPI.removeAllListeners('activity-reset');
            window.electronAPI.removeAllListeners('system-suspend');
            window.electronAPI.removeAllListeners('system-resume');
            window.electronAPI.removeAllListeners('system-lock');
            window.electronAPI.removeAllListeners('system-unlock');
          }
        } catch (error) {
          console.warn('Error removing event listeners:', error);
        }
        listenersSetupRef.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only once

  // Get current activity status periodically
  useEffect(() => {
    if (isTracking) {
      const interval = setInterval(() => {
        getActivityStatus();
      }, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
    }
  }, [isTracking, getActivityStatus]);

  return {
    isTracking,
    lastActivity,
    showInactivityDialog,
    inactivityData,
    activityStatus,
    isScreenLocked,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    setInactivityThreshold,
    getActivityStatus,
    setShowInactivityDialog
  };
}; 