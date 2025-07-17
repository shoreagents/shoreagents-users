import { getCurrentUser } from "./ticket-utils"

interface BreakHistory {
  [key: string]: {
    used: boolean
    paused: boolean
    timeLeft?: number // Time left in seconds when paused
    startTime?: number // When the break was started (timestamp)
    pauseTime?: number // When the emergency pause was used (timestamp)
    emergencyPauseUsed?: boolean // Track if emergency pause was used for this break
  }
}

const getBreakStorageKey = (userEmail: string) => {
  return `shoreagents-break-history-${userEmail}`
}

const getBreakDateKey = (userEmail: string) => {
  return `shoreagents-break-date-${userEmail}`
}

export function getBreakHistory(): BreakHistory {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser?.email) {
      return {
        morning: { used: false, paused: false },
        lunch: { used: false, paused: false },
        afternoon: { used: false, paused: false }
      }
    }

    const userEmail = currentUser.email
    const storedDate = localStorage.getItem(getBreakDateKey(userEmail))
    const today = new Date().toDateString()
    
    // Reset history if it's a new day
    if (storedDate !== today) {
      localStorage.setItem(getBreakDateKey(userEmail), today)
      localStorage.removeItem(getBreakStorageKey(userEmail))
      return {
        morning: { used: false, paused: false },
        lunch: { used: false, paused: false },
        afternoon: { used: false, paused: false }
      }
    }
    
    const stored = localStorage.getItem(getBreakStorageKey(userEmail))
    if (stored) {
      return JSON.parse(stored)
    }
    
    return {
      morning: { used: false, paused: false },
      lunch: { used: false, paused: false },
      afternoon: { used: false, paused: false }
    }
  } catch (error) {
    console.error('Error loading break history:', error)
    return {
      morning: { used: false, paused: false },
      lunch: { used: false, paused: false },
      afternoon: { used: false, paused: false }
    }
  }
}

export function saveBreakHistory(history: BreakHistory): void {
  try {
    const currentUser = getCurrentUser()
    if (!currentUser?.email) return

    const userEmail = currentUser.email
    localStorage.setItem(getBreakStorageKey(userEmail), JSON.stringify(history))
  } catch (error) {
    console.error('Error saving break history:', error)
  }
}

export function updateBreakStatus(breakId: string, status: { used?: boolean; paused?: boolean; timeLeft?: number; startTime?: number; pauseTime?: number; emergencyPauseUsed?: boolean }): void {
  try {
    const history = getBreakHistory()
    history[breakId] = { ...history[breakId], ...status }
    saveBreakHistory(history)
  } catch (error) {
    console.error('Error updating break status:', error)
  }
}

export function saveBreakTimerState(breakId: string, timeLeft: number, startTime: number, pauseTime: number): void {
  try {
    const history = getBreakHistory()
    history[breakId] = { 
      ...history[breakId], 
      timeLeft: timeLeft,
      startTime: startTime,
      pauseTime: pauseTime,
      emergencyPauseUsed: true // Mark that emergency pause was used
    }
    saveBreakHistory(history)
  } catch (error) {
    console.error('Error saving break timer state:', error)
  }
}

export function clearBreakTimerState(breakId: string): void {
  try {
    const history = getBreakHistory()
    history[breakId] = { 
      ...history[breakId], 
      timeLeft: undefined,
      startTime: undefined,
      pauseTime: undefined,
      emergencyPauseUsed: false
    }
    saveBreakHistory(history)
  } catch (error) {
    console.error('Error clearing break timer state:', error)
  }
} 