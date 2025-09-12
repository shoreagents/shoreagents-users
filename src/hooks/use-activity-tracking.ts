import { useState, useEffect, useCallback } from 'react';
// import { startActiveSession, startInactiveSession, updateLastActivity, initializeUserActivity, pauseActivityForSystemSuspend, resumeActivityFromSystemSuspend } from '@/lib/activity-storage';
import { getCurrentUser } from '@/lib/ticket-utils';

interface ActivityData {
  timestamp: number;
  position: { x: number; y: number };
  systemSuspended?: boolean;
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

export const useActivityTracking = (setActivityState?: (isActive: boolean) => void) => {
  const [isTracking, setIsTracking] = useState(false);
  const [lastActivity, setLastActivity] = useState<ActivityData | null>(null);
  const [showInactivityDialog, setShowInactivityDialog] = useState(false);
  const [inactivityData, setInactivityData] = useState<InactivityAlert | null>(null);
  const [activityStatus, setActivityStatus] = useState<ActivityStatus | null>(null);

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
      }
    } catch (error) {
      console.error('Error starting activity tracking:', error);
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
        return status;
      } else {
        console.error('Failed to get activity status:', status.error);
      }
    } catch (error) {
      console.error('Error getting activity status:', error);
    }
  }, []);

  // Handle activity updates
  const handleActivityUpdate = useCallback((data: unknown) => {
    const activityData = data as ActivityData;
    
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
    setShowInactivityDialog(false);
    setInactivityData(null);
    
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
    
    const alertData = data as InactivityAlert;
    setInactivityData(alertData);
    setShowInactivityDialog(true);
    
    // CRITICAL: Set activity state to inactive when inactivity is detected
    if (setActivityState) {
      setActivityState(false);
    }
    
    // Start inactive session when inactivity is detected
    // TODO: Replace with database-driven inactive session
    // startInactiveSession(currentUser.email);
  }, [isTracking, stopTracking, setActivityState]);

  // Handle activity reset
  const handleActivityReset = useCallback((data: unknown) => {
    // Don't process activity reset if user is not authenticated
    const currentUser = getCurrentUser();
    if (!currentUser) {
      return;
    }
    
    const resetData = data as { timestamp: number };
    setLastActivity({ timestamp: resetData.timestamp, position: { x: 0, y: 0 } });
    setShowInactivityDialog(false);
    setInactivityData(null);
    
    // CRITICAL: Set activity state to active when activity is reset
    if (setActivityState) {
      setActivityState(true);
    }
    
    // Just update last activity time when activity is reset
    // TODO: Replace with database-driven activity update
    // updateLastActivity(currentUser.email);
  }, [setActivityState]);

  // Handle system suspend events
  const handleSystemSuspend = useCallback(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      // TODO: Replace with database-driven system suspend
      // pauseActivityForSystemSuspend(currentUser.email);
    }
    setShowInactivityDialog(false); // Close any inactivity dialogs
  }, []);

  // Handle system resume events
  const handleSystemResume = useCallback(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      // TODO: Replace with database-driven system resume
      // resumeActivityFromSystemSuspend(currentUser.email);
    }
  }, []);

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

  // Set up event listeners
  useEffect(() => {
    // Check if electronAPI is available
    if (!window.electronAPI) {
      console.warn('electronAPI not available - running in browser mode');
      return;
    }

    // Listen for activity updates
    window.electronAPI.receive('activity-update', handleActivityUpdate);
    
    // Listen for inactivity alerts
    window.electronAPI.receive('inactivity-alert', handleInactivityAlert);
    
    // Listen for activity resets
    window.electronAPI.receive('activity-reset', handleActivityReset);
    
    // Listen for system suspend/resume events
    window.electronAPI.receive('system-suspend', handleSystemSuspend);
    window.electronAPI.receive('system-resume', handleSystemResume);

    // Cleanup listeners on unmount
    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('activity-update');
        window.electronAPI.removeAllListeners('inactivity-alert');
        window.electronAPI.removeAllListeners('activity-reset');
        window.electronAPI.removeAllListeners('system-suspend');
        window.electronAPI.removeAllListeners('system-resume');
      }
    };
  }, [handleActivityUpdate, handleInactivityAlert, handleActivityReset]);

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
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    setInactivityThreshold,
    getActivityStatus,
    setShowInactivityDialog
  };
}; 