import { Coffee, Utensils, Sun } from "lucide-react"

/**
 * Shift-based Break Utilities
 * Determines break titles and valid times based on agent's shift period and time
 */

export interface ShiftInfo {
  shift_period: string // "Day Shift", "Night Shift", etc.
  shift_schedule: string // "Monday-Friday", "Tuesday-Saturday", etc.
  shift_time: string // "6:00 AM - 3:00 PM", "10:00 PM - 7:00 AM", etc.
}

export interface BreakInfo {
  id: string
  name: string
  duration: number // in minutes
  startTime: string // 24-hour format
  endTime: string // 24-hour format
  icon: React.ComponentType<any>
  description: string
  color: string
  validForShifts: string[] // which shifts this break applies to
}

export interface CustomBreakInfo {
  break_type: string
  start_time: string
  end_time: string
  duration_minutes: number
}

// Parse shift time string (e.g., "6:00 AM - 3:00 PM")
export function parseShiftTime(shiftTime: string): { start: string; end: string } | null {
  if (!shiftTime) return null
  
  const parts = shiftTime.split(' - ')
  if (parts.length !== 2) return null
  
  const startTime = parts[0].trim()
  const endTime = parts[1].trim()
  
  return { start: startTime, end: endTime }
}

// Convert 12-hour time to 24-hour format
export function convertTo24Hour(time12h: string): string {
  const [time, modifier] = time12h.split(' ')
  let [hours, minutes] = time.split(':')
  
  hours = hours.padStart(2, '0')
  minutes = minutes.padStart(2, '0')
  
  if (hours === '12') {
    hours = modifier === 'PM' ? '12' : '00'
  } else if (modifier === 'PM') {
    hours = String(parseInt(hours) + 12)
  }
  
  return `${hours}:${minutes}`
}

// Convert 24-hour time to 12-hour format
export function convertTo12Hour(time24h: string): string {
  const [hours, minutes] = time24h.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  
  return `${hour12}:${minutes} ${ampm}`
}

// Determine if shift is night shift (crosses midnight)
export function isNightShift(shiftTime: string): boolean {
  const parsed = parseShiftTime(shiftTime)
  if (!parsed) return false
  
  const start24 = convertTo24Hour(parsed.start)
  const end24 = convertTo24Hour(parsed.end)
  
  const startHour = parseInt(start24.split(':')[0])
  const endHour = parseInt(end24.split(':')[0])
  
  // Night shift: start time is later than end time (e.g., 10 PM - 7 AM)
  return startHour > endHour
}

// Calculate break times based on shift time
function calculateBreakTimes(shiftTime: string): { morning: { start: string; end: string }; lunch: { start: string; end: string }; afternoon: { start: string; end: string } } | null {
  const parsed = parseShiftTime(shiftTime)
  if (!parsed) return null
  
  const start24 = convertTo24Hour(parsed.start)
  const end24 = convertTo24Hour(parsed.end)
  
  const [startHour, startMinute] = start24.split(':').map(Number)
  const [endHour, endMinute] = end24.split(':').map(Number)
  
  const isNight = isNightShift(shiftTime)
  
  // Calculate total shift duration
  let shiftDuration: number
  if (isNight) {
    // Night shift crosses midnight
    shiftDuration = (24 - startHour) + endHour
  } else {
    // Day shift within same day
    shiftDuration = endHour - startHour
  }
  
  if (isNight) {
    // Night shift breaks - same pattern as day shifts (relative to shift start)
    // Morning: 2 hours after start (1 hour duration)
    // Lunch: 4 hours after start (3 hours duration) 
    // Afternoon: 7h45m after start (1 hour duration)
    
    // Convert start time to total minutes for accurate calculation
    const startTotalMinutes = startHour * 60 + startMinute
    
    const morningStartMinutes = startTotalMinutes + (2 * 60) // 2 hours after start
    const morningEndMinutes = startTotalMinutes + (3 * 60)   // 3 hours after start (1 hour duration)
    
    const lunchStartMinutes = startTotalMinutes + (4 * 60)   // 4 hours after start
    const lunchEndMinutes = startTotalMinutes + (7 * 60)     // 7 hours after start (3 hours duration)
    
    const afternoonStartMinutes = startTotalMinutes + (7 * 60 + 45) // 7 hours 45 minutes after start
    const afternoonEndMinutes = startTotalMinutes + (8 * 60 + 45)   // 8 hours 45 minutes after start (1 hour duration)
    
    // Helper function to convert minutes back to HH:MM format (handles day rollover for night shifts)
    const minutesToTime = (totalMinutes: number): string => {
      const hours = Math.floor(totalMinutes / 60) % 24
      const minutes = totalMinutes % 60
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    }
    
    return {
      morning: {
        start: minutesToTime(morningStartMinutes),
        end: minutesToTime(morningEndMinutes)
      },
      lunch: {
        start: minutesToTime(lunchStartMinutes),
        end: minutesToTime(lunchEndMinutes)
      },
      afternoon: {
        start: minutesToTime(afternoonStartMinutes),
        end: minutesToTime(afternoonEndMinutes)
      }
    }
  } else {
    // Day shift breaks - relative to shift start time
    // Morning: 2 hours after start (1 hour duration)
    // Lunch: 4 hours after start (3 hours duration) 
    // Afternoon: 7.75 hours after start (1 hour duration)
    
    // Convert start time to total minutes for accurate calculation
    const startTotalMinutes = startHour * 60 + startMinute
    
    const morningStartMinutes = startTotalMinutes + (2 * 60) // 2 hours after start
    const morningEndMinutes = startTotalMinutes + (3 * 60)   // 3 hours after start (1 hour duration)
    
    const lunchStartMinutes = startTotalMinutes + (4 * 60)   // 4 hours after start
    const lunchEndMinutes = startTotalMinutes + (7 * 60)     // 7 hours after start (3 hours duration)
    
    const afternoonStartMinutes = startTotalMinutes + (7 * 60 + 45) // 7 hours 45 minutes after start
    const afternoonEndMinutes = startTotalMinutes + (8 * 60 + 45)   // 8 hours 45 minutes after start (1 hour duration)
    
    // Helper function to convert minutes back to HH:MM format
    const minutesToTime = (totalMinutes: number): string => {
      const hours = Math.floor(totalMinutes / 60) % 24
      const minutes = totalMinutes % 60
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    }
    
    return {
      morning: {
        start: minutesToTime(morningStartMinutes),
        end: minutesToTime(morningEndMinutes)
      },
      lunch: {
        start: minutesToTime(lunchStartMinutes),
        end: minutesToTime(lunchEndMinutes)
      },
      afternoon: {
        start: minutesToTime(afternoonStartMinutes),
        end: minutesToTime(afternoonEndMinutes)
      }
    }
  }
}

// Get break configuration based on shift
export function getBreaksForShift(shiftInfo: ShiftInfo): BreakInfo[] {
  const isNight = isNightShift(shiftInfo.shift_time)
  const shiftPeriod = shiftInfo.shift_period?.toLowerCase() || ''
  
  // Calculate break times based on actual shift
  const breakTimes = calculateBreakTimes(shiftInfo.shift_time)
  if (!breakTimes) {
    // Fallback to static times if shift parsing fails
    return []
  }
  
  // Base break configurations with dynamic times
  const baseBreaks: BreakInfo[] = [
    {
      id: "Morning",
      name: "Morning Break",
      duration: 15,
      startTime: breakTimes.morning.start,
      endTime: breakTimes.morning.end,
      icon: Coffee,
      description: "Take a 15-minute morning break",
      color: "bg-orange-500",
      validForShifts: ["day shift", "morning shift"]
    },
    {
      id: "Lunch",
      name: "Lunch Break",
      duration: 60,
      startTime: breakTimes.lunch.start,
      endTime: breakTimes.lunch.end,
      icon: Utensils,
      description: "Take a 1-hour lunch break",
      color: "bg-green-500",
      validForShifts: ["day shift", "morning shift", "afternoon shift"]
    },
    {
      id: "Afternoon",
      name: "Afternoon Break",
      duration: 15,
      startTime: breakTimes.afternoon.start,
      endTime: breakTimes.afternoon.end,
      icon: Sun,
      description: "Take a 15-minute afternoon break",
      color: "bg-blue-500",
      validForShifts: ["day shift", "afternoon shift"]
    }
  ]
  
  // Night shift specific breaks with dynamic times
  const nightBreaks: BreakInfo[] = [
    {
      id: "NightFirst",
      name: "First Night Break",
      duration: 15,
      startTime: breakTimes.morning.start,
      endTime: breakTimes.morning.end,
      icon: Coffee,
      description: "Take a 15-minute night break",
      color: "bg-purple-500",
      validForShifts: ["night shift", "graveyard shift"]
    },
    {
      id: "NightMeal",
      name: "Night Meal Break",
      duration: 60,
      startTime: breakTimes.lunch.start,
      endTime: breakTimes.lunch.end,
      icon: Utensils,
      description: "Take a 60-minute night meal break",
      color: "bg-indigo-500",
      validForShifts: ["night shift", "graveyard shift"]
    },
    {
      id: "NightSecond",
      name: "Second Night Break",
      duration: 15,
      startTime: breakTimes.afternoon.start,
      endTime: breakTimes.afternoon.end,
      icon: Sun,
      description: "Take a 15-minute early morning break",
      color: "bg-yellow-500",
      validForShifts: ["night shift", "graveyard shift"]
    }
  ]
  
  // Return appropriate breaks based on shift type
  if (isNight) {
    return nightBreaks
  } else {
    return baseBreaks
  }
}

// Get break title based on shift and time
export function getBreakTitle(breakId: string, shiftInfo: ShiftInfo): string {
  const isNight = isNightShift(shiftInfo.shift_time)
  
     const breakTitles: Record<string, Record<string, string>> = {
     day: {
       Morning: "Morning Break",
       Lunch: "Lunch Break", 
       Afternoon: "Afternoon Break"
     },
     night: {
       NightFirst: "First Night Break",
       NightMeal: "Night Meal Break",
       NightSecond: "Second Night Break"
     }
   }
  
  const shiftType = isNight ? 'night' : 'day'
  return breakTitles[shiftType][breakId] || breakId
}

// Check if a break is currently valid based on current time and shift
export function isBreakTimeValid(breakInfo: BreakInfo, shiftInfo: ShiftInfo, currentTime: Date = new Date()): boolean {
  const parsedShift = parseShiftTime(shiftInfo.shift_time)
  if (!parsedShift) return false
  
  const currentHour = currentTime.getHours()
  const currentMinute = currentTime.getMinutes()
  const currentTime24 = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`
  
  const [breakStartHour, breakStartMinute] = breakInfo.startTime.split(':').map(Number)
  const [breakEndHour, breakEndMinute] = breakInfo.endTime.split(':').map(Number)
  
  const breakStartMinutes = breakStartHour * 60 + breakStartMinute
  const breakEndMinutes = breakEndHour * 60 + breakEndMinute
  const currentMinutes = currentHour * 60 + currentMinute
  
  // Handle night shift breaks that cross midnight
  if (isNightShift(shiftInfo.shift_time)) {
    if (breakStartHour > breakEndHour) {
      // Break crosses midnight (e.g., 23:00 - 01:00)
      if (currentHour >= breakStartHour || currentHour < breakEndHour) {
        return true
      }
    } else {
      // Break within same day (e.g., 00:00 - 02:00)
      if (currentMinutes >= breakStartMinutes && currentMinutes <= breakEndMinutes) {
        return true
      }
    }
  } else {
    // Day shift - simple time comparison
    if (currentMinutes >= breakStartMinutes && currentMinutes <= breakEndMinutes) {
      return true
    }
  }
  
  return false
}

// Get next valid break time
export function getNextBreakTime(breakInfo: BreakInfo, shiftInfo: ShiftInfo, currentTime: Date = new Date()): Date | null {
  const currentHour = currentTime.getHours()
  const currentMinute = currentTime.getMinutes()
  const currentMinutes = currentHour * 60 + currentMinute
  
  const [breakStartHour, breakStartMinute] = breakInfo.startTime.split(':').map(Number)
  const breakStartMinutes = breakStartHour * 60 + breakStartMinute
  
  if (isNightShift(shiftInfo.shift_time)) {
    // For night shifts, calculate next occurrence
    const nextBreak = new Date(currentTime)
    
    if (breakStartHour > currentHour || (breakStartHour === currentHour && breakStartMinute > currentMinute)) {
      // Break is later today
      nextBreak.setHours(breakStartHour, breakStartMinute, 0, 0)
    } else {
      // Break is tomorrow
      nextBreak.setDate(nextBreak.getDate() + 1)
      nextBreak.setHours(breakStartHour, breakStartMinute, 0, 0)
    }
    
    return nextBreak
  } else {
    // For day shifts, if break time has passed, it's not available today
    if (currentMinutes >= breakStartMinutes) {
      return null
    }
    
    const nextBreak = new Date(currentTime)
    nextBreak.setHours(breakStartHour, breakStartMinute, 0, 0)
    return nextBreak
  }
}

// Check if user has custom break settings
export async function userHasCustomBreaks(userId: number): Promise<boolean> {
  try {
    const response = await fetch(`/api/breaks/custom/check?user_id=${userId}`, {
      credentials: 'include'
    })
    const result = await response.json()
    return result.success && result.hasCustomBreaks
  } catch (error) {
    console.error('Error checking custom breaks:', error)
    return false
  }
}

// Get user's custom break settings
export async function getUserCustomBreaks(userId: number): Promise<CustomBreakInfo[]> {
  try {
    const response = await fetch(`/api/breaks/custom?user_id=${userId}`, {
      credentials: 'include'
    })
    const result = await response.json()
    return result.success ? result.breaks : []
  } catch (error) {
    console.error('Error fetching custom breaks:', error)
    return []
  }
}

// Get break configuration with custom times if available
export async function getBreaksForShiftWithCustom(shiftInfo: ShiftInfo, userId?: number): Promise<BreakInfo[]> {
  // If no userId provided, use default shift-based breaks
  if (!userId) {
    return getBreaksForShift(shiftInfo)
  }

  // Check if user has custom break settings
  const hasCustomBreaks = await userHasCustomBreaks(userId)
  
  if (!hasCustomBreaks) {
    // Return default breaks but they will be disabled (no custom times set)
    return getBreaksForShift(shiftInfo)
  }

  // Get custom break settings
  const customBreaks = await getUserCustomBreaks(userId)
  
  if (customBreaks.length === 0) {
    // Return default breaks but they will be disabled (no custom times set)
    return getBreaksForShift(shiftInfo)
  }

  // Convert custom breaks to BreakInfo format
  const isNight = isNightShift(shiftInfo.shift_time)
  const breakInfoMap: Record<string, BreakInfo> = {}

  // Create base break configurations
  const baseBreaks: BreakInfo[] = [
    {
      id: "Morning",
      name: "Morning Break",
      duration: 15,
      startTime: "08:00",
      endTime: "09:00",
      icon: Coffee,
      description: "Take a 15-minute morning break",
      color: "bg-orange-500",
      validForShifts: ["day shift", "morning shift"]
    },
    {
      id: "Lunch",
      name: "Lunch Break",
      duration: 60,
      startTime: "12:00",
      endTime: "13:00",
      icon: Utensils,
      description: "Take a 1-hour lunch break",
      color: "bg-green-500",
      validForShifts: ["day shift", "morning shift", "afternoon shift"]
    },
    {
      id: "Afternoon",
      name: "Afternoon Break",
      duration: 15,
      startTime: "15:00",
      endTime: "16:00",
      icon: Sun,
      description: "Take a 15-minute afternoon break",
      color: "bg-blue-500",
      validForShifts: ["day shift", "afternoon shift"]
    }
  ]

  const nightBreaks: BreakInfo[] = [
    {
      id: "NightFirst",
      name: "First Night Break",
      duration: 15,
      startTime: "00:00",
      endTime: "01:00",
      icon: Coffee,
      description: "Take a 15-minute night break",
      color: "bg-purple-500",
      validForShifts: ["night shift", "graveyard shift"]
    },
    {
      id: "NightMeal",
      name: "Night Meal Break",
      duration: 60,
      startTime: "02:00",
      endTime: "03:00",
      icon: Utensils,
      description: "Take a 60-minute night meal break",
      color: "bg-indigo-500",
      validForShifts: ["night shift", "graveyard shift"]
    },
    {
      id: "NightSecond",
      name: "Second Night Break",
      duration: 15,
      startTime: "05:00",
      endTime: "06:00",
      icon: Sun,
      description: "Take a 15-minute early morning break",
      color: "bg-yellow-500",
      validForShifts: ["night shift", "graveyard shift"]
    }
  ]

  // Create map of all possible breaks
  const allBreaks = isNight ? nightBreaks : baseBreaks
  allBreaks.forEach(breakInfo => {
    breakInfoMap[breakInfo.id] = breakInfo
  })

  // Update with custom times
  customBreaks.forEach(customBreak => {
    const breakId = customBreak.break_type
    if (breakInfoMap[breakId]) {
      breakInfoMap[breakId] = {
        ...breakInfoMap[breakId],
        startTime: customBreak.start_time,
        endTime: customBreak.end_time,
        duration: customBreak.duration_minutes
      }
    }
  })

  // Return only the breaks that have custom settings
  return Object.values(breakInfoMap).filter(breakInfo => 
    customBreaks.some(custom => custom.break_type === breakInfo.id)
  )
} 