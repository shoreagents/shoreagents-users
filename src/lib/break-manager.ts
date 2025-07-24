/**
 * Break Manager Utility for ShoreAgents
 * Handles break sessions with database persistence and localStorage for real-time tracking
 */

import { getCurrentUserInfo } from './user-profiles';

export type BreakType = 'Morning' | 'Lunch' | 'Afternoon';

export interface CurrentBreak {
  id?: number;
  break_type: BreakType;
  start_time: string;
  agent_user_id: number;
  is_paused?: boolean;
  pause_time?: string;
  resume_time?: string;
  time_remaining_seconds?: number;
  pause_used?: boolean;
  last_updated?: number; // Timestamp of last timer state update
}

export interface BreakSession {
  id: number;
  agent_user_id: number;
  break_type: BreakType;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  created_at: string;
}

export interface BreakStatus {
  is_on_break: boolean;
  active_break?: BreakSession & { 
    current_duration_minutes: number;
    is_paused?: boolean;
    can_pause?: boolean;
    pause_time?: string;
    resume_time?: string;
    pause_used?: boolean;
    time_remaining_at_pause?: number;
  };
  today_summary: {
    total_breaks: number;
    completed_breaks: number;
    total_minutes: number;
    breaks_by_type: {
      Morning: number;
      Lunch: number;
      Afternoon: number;
    };
  };
  today_breaks: BreakSession[];
}

/**
 * Get current break from localStorage
 */
export function getCurrentBreak(): CurrentBreak | null {
  try {
    const breakData = localStorage.getItem('currentBreak');
    return breakData ? JSON.parse(breakData) : null;
  } catch (error) {
    console.error('Error parsing current break from localStorage:', error);
    return null;
  }
}

/**
 * Start a new break session
 */
export async function startBreak(breakType: BreakType): Promise<{ success: boolean; message?: string; breakSession?: BreakSession }> {
  try {
    const currentUser = getCurrentUserInfo();
    
    if (!currentUser || !currentUser.id) {
      return { success: false, message: 'User not authenticated' };
    }

    // Check if already on break
    const existingBreak = getCurrentBreak();
    if (existingBreak) {
      return { success: false, message: 'Already on a break. Please end current break first.' };
    }

    // Start break in database
    const response = await fetch('/api/breaks/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_user_id: currentUser.id,
        break_type: breakType
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      return { success: false, message: result.error };
    }

    // Store in localStorage for real-time tracking
    const currentBreak: CurrentBreak = {
      id: result.breakSession.id,
      break_type: breakType,
      start_time: result.breakSession.start_time,
      agent_user_id: currentUser.id
    };

    localStorage.setItem('currentBreak', JSON.stringify(currentBreak));
    
;
    return { success: true, message: `${breakType} break started`, breakSession: result.breakSession };

  } catch (error) {
    console.error('Error starting break:', error);
    return { success: false, message: 'Failed to start break session' };
  }
}

/**
 * End the current break session
 */
export async function endBreak(): Promise<{ success: boolean; message?: string; breakSession?: BreakSession & { duration_minutes: number } }> {
  try {
    const currentBreak = getCurrentBreak();
    
    if (!currentBreak) {
      // Clear any stale localStorage data
      localStorage.removeItem('currentBreak');
      return { success: true, message: 'No active break session found - cleared stale data' };
    }

    // End break in database
    const response = await fetch('/api/breaks/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_user_id: currentBreak.agent_user_id
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      // If the API says no active break, that's actually success for us
      if (result.error && result.error.toLowerCase().includes('no active break')) {
        localStorage.removeItem('currentBreak');
        return { success: true, message: 'Break session already ended' };
      }
      return { success: false, message: result.error };
    }

    // Clear localStorage
    localStorage.removeItem('currentBreak');
    
    return { 
      success: true, 
      message: `Break ended (${result.breakSession?.duration_minutes || 0} minutes)`, 
      breakSession: result.breakSession 
    };

  } catch (error) {
    console.error('Error ending break:', error);
    // If there's a network error but we have no current break, clear localStorage
    const currentBreak = getCurrentBreak();
    if (!currentBreak) {
      localStorage.removeItem('currentBreak');
      return { success: true, message: 'Break session cleared due to network error' };
    }
    return { success: false, message: 'Failed to end break session' };
  }
}

/**
 * Pause the current break session (emergency pause - once per break)
 */
export async function pauseBreak(timeRemainingSeconds: number): Promise<{ success: boolean; message?: string; breakSession?: any }> {
  try {
    const currentBreak = getCurrentBreak();
    
    if (!currentBreak) {
      return { success: false, message: 'No active break session found' };
    }

    // Pause break in database
    const response = await fetch('/api/breaks/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_user_id: currentBreak.agent_user_id,
        time_remaining_seconds: timeRemainingSeconds
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      // Provide more specific error messages for common pause issues
      if (result.error.includes('already used')) {
        return { success: false, message: 'This break was already paused. Please use the Resume button from the breaks page.' };
      } else if (result.error.includes('already paused')) {
        return { success: false, message: 'Break is already paused. Please use the Resume button from the breaks page.' };
      }
      return { success: false, message: result.error };
    }

    // Update localStorage with pause state
    const pausedBreak = {
      ...currentBreak,
      is_paused: true,
      pause_time: result.breakSession.pause_time,
      time_remaining_seconds: timeRemainingSeconds,
      pause_used: true
    };

    localStorage.setItem('currentBreak', JSON.stringify(pausedBreak));
    
;
    return { 
      success: true, 
      message: `Break paused (${Math.floor(timeRemainingSeconds / 60)}:${(timeRemainingSeconds % 60).toString().padStart(2, '0')} remaining)`, 
      breakSession: result.breakSession 
    };

  } catch (error) {
    console.error('Error pausing break:', error);
    return { success: false, message: 'Failed to pause break session' };
  }
}

/**
 * Resume a paused break session
 */
export async function resumeBreak(): Promise<{ success: boolean; message?: string; breakSession?: any }> {
  try {
    const currentBreak = getCurrentBreak();
    
    if (!currentBreak) {
      return { success: false, message: 'No break session found' };
    }

    if (!currentBreak.is_paused) {
      return { success: false, message: 'Break session is not paused' };
    }

    // Resume break in database
    const response = await fetch('/api/breaks/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_user_id: currentBreak.agent_user_id
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      return { success: false, message: result.error };
    }

    // Update localStorage with resumed state
    const resumedBreak = {
      ...currentBreak,
      is_paused: false,
      resume_time: result.breakSession.resume_time,
      pause_used: true // Keep this flag set
    };

    localStorage.setItem('currentBreak', JSON.stringify(resumedBreak));
    
;
    return { 
      success: true, 
      message: `Break resumed`, 
      breakSession: result.breakSession 
    };

  } catch (error) {
    console.error('Error resuming break:', error);
    return { success: false, message: 'Failed to resume break session' };
  }
}

/**
 * Get current break status from database
 */
export async function getBreakStatus(): Promise<{ success: boolean; status?: BreakStatus; message?: string }> {
  try {
    const currentUser = getCurrentUserInfo();
    
    if (!currentUser || !currentUser.id) {
      return { success: false, message: 'User not authenticated' };
    }

    const response = await fetch(`/api/breaks/status?agent_user_id=${currentUser.id}`);
    const result = await response.json();
    
    if (!result.success) {
      return { success: false, message: result.error };
    }

    return { success: true, status: result.status };

  } catch (error) {
    console.error('Error fetching break status:', error);
    return { success: false, message: 'Failed to fetch break status' };
  }
}

/**
 * Get break history for the agent
 */
export async function getBreakHistory(days: number = 7, includeActive: boolean = true): Promise<{ success: boolean; data?: any; message?: string }> {
  try {
    const currentUser = getCurrentUserInfo();
    
    if (!currentUser || !currentUser.id) {
      return { success: false, message: 'User not authenticated' };
    }

    const response = await fetch(`/api/breaks/history?agent_user_id=${currentUser.id}&days=${days}&include_active=${includeActive}`);
    const result = await response.json();
    
    if (!result.success) {
      return { success: false, message: result.error };
    }

    return { success: true, data: result.data };

  } catch (error) {
    console.error('Error fetching break history:', error);
    return { success: false, message: 'Failed to fetch break history' };
  }
}

/**
 * Calculate elapsed time for current break
 */
export function getCurrentBreakDuration(): number | null {
  const currentBreak = getCurrentBreak();
  
  if (!currentBreak || !currentBreak.start_time) {
    return null;
  }

  const startTime = new Date(currentBreak.start_time);
  const now = new Date();
  const durationMs = now.getTime() - startTime.getTime();
  
  return Math.floor(durationMs / 1000 / 60); // Return minutes
}

/**
 * Format duration in minutes to human readable format
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Check if break type is allowed at current time (optional business logic)
 */
export function isBreakAllowed(breakType: BreakType): { allowed: boolean; reason?: string } {
  const now = new Date();
  const hour = now.getHours();
  
  switch (breakType) {
    case 'Morning':
      if (hour < 9 || hour > 12) {
        return { allowed: false, reason: 'Morning breaks are typically allowed between 9 AM - 12 PM' };
      }
      break;
    case 'Lunch':
      if (hour < 11 || hour > 15) {
        return { allowed: false, reason: 'Lunch breaks are typically allowed between 11 AM - 3 PM' };
      }
      break;
    case 'Afternoon':
      if (hour < 14 || hour > 17) {
        return { allowed: false, reason: 'Afternoon breaks are typically allowed between 2 PM - 5 PM' };
      }
      break;
  }
  
  return { allowed: true };
}

/**
 * Sync localStorage with database (useful for error recovery)
 */
export async function syncBreakStatus(): Promise<void> {
  try {
    const localBreak = getCurrentBreak();
    const { success, status } = await getBreakStatus();
    
    if (!success || !status) {
      return;
    }
    
    // If database shows active break but localStorage is empty, restore it
    if (status.is_on_break && status.active_break && !localBreak) {
      const currentBreak: CurrentBreak = {
        id: status.active_break.id,
        break_type: status.active_break.break_type,
        start_time: status.active_break.start_time,
        agent_user_id: status.active_break.agent_user_id
      };
      
      localStorage.setItem('currentBreak', JSON.stringify(currentBreak));
      console.log('🔄 Restored break session from database');
    }
    
    // If localStorage shows break but database doesn't, clear localStorage
    if (!status.is_on_break && localBreak) {
      localStorage.removeItem('currentBreak');
      console.log('🔄 Cleared outdated break session from localStorage');
    }
    
  } catch (error) {
    console.error('Error syncing break status:', error);
  }
} 