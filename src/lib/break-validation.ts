/**
 * Break Time Validation Utilities
 * Validates break scheduling against shift times and prevents overlapping breaks
 */

import { parseShiftTime } from './shift-utils'

export interface BreakTimeValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface BreakTimeSlot {
  break_type: string
  start_time: string // HH:MM or HH:MM:SS format
  end_time: string   // HH:MM or HH:MM:SS format
  duration_minutes: number
}

/**
 * Convert time string (HH:MM or HH:MM:SS) to minutes since midnight
 */
function timeToMinutes(timeStr: string): number {
  // Handle both HH:MM and HH:MM:SS formats
  const timeParts = timeStr.split(':')
  const hours = parseInt(timeParts[0])
  const minutes = parseInt(timeParts[1])
  return hours * 60 + minutes
}

/**
 * Convert minutes since midnight to time string (HH:MM)
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

/**
 * Check if two time ranges overlap
 */
function timeRangesOverlap(
  start1: number, end1: number,
  start2: number, end2: number
): boolean {
  // Two ranges overlap if one starts before the other ends
  return start1 < end2 && start2 < end1
}

/**
 * Parse shift time and return start/end times in minutes since midnight
 */
function parseShiftTimeToMinutes(shiftTime: string): { start: number; end: number; isNightShift: boolean } | null {
  const parsed = parseShiftTime(shiftTime)
  if (!parsed) return null

  const startMinutes = parsed.startTime.getHours() * 60 + parsed.startTime.getMinutes()
  let endMinutes = parsed.endTime.getHours() * 60 + parsed.endTime.getMinutes()

  // Handle night shifts that cross midnight
  if (parsed.isNightShift && endMinutes <= startMinutes) {
    endMinutes += 24 * 60 // Add 24 hours for night shifts
  }

  return { start: startMinutes, end: endMinutes, isNightShift: parsed.isNightShift }
}

/**
 * Get the valid time window for a break type
 */
function getBreakValidWindow(breakType: string): number {
  switch (breakType) {
    case 'Morning':
    case 'Afternoon':
    case 'NightFirst':
    case 'NightSecond':
      return 60 // 1 hour valid window
    case 'Lunch':
    case 'NightMeal':
      return 180 // 3 hours valid window
    default:
      return 60 // Default to 1 hour
  }
}

/**
 * Validate break time against shift hours
 */
function validateBreakAgainstShift(
  breakSlot: BreakTimeSlot,
  shiftTime: string
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  const shiftTimes = parseShiftTimeToMinutes(shiftTime)
  if (!shiftTimes) {
    errors.push('Invalid shift time format')
    return { isValid: false, errors }
  }

  const breakStart = timeToMinutes(breakSlot.start_time)
  const breakEnd = timeToMinutes(breakSlot.end_time)

  // Check if break is within shift hours
  if (shiftTimes.isNightShift) {
    // Night shift - handle midnight crossing
    const isBreakBeforeMidnight = breakStart >= shiftTimes.start
    const isBreakAfterMidnight = breakEnd <= (shiftTimes.end % (24 * 60))
    
    if (!isBreakBeforeMidnight && !isBreakAfterMidnight) {
      errors.push(`Break time must be within shift hours (${minutesToTime(shiftTimes.start)} - ${minutesToTime(shiftTimes.end % (24 * 60))})`)
    }
  } else {
    // Day shift - simple range check
    if (breakStart < shiftTimes.start || breakEnd > shiftTimes.end) {
      errors.push(`Break time must be within shift hours (${minutesToTime(shiftTimes.start)} - ${minutesToTime(shiftTimes.end)})`)
    }
  }

  // Check if break ends at least 15 minutes before shift ends
  const shiftEndTime = shiftTimes.isNightShift ? (shiftTimes.end % (24 * 60)) : shiftTimes.end
  const minimumGap = 15 // 15 minutes before shift ends
  const latestAllowedEnd = shiftEndTime - minimumGap
  
  if (breakEnd > latestAllowedEnd) {
    const latestAllowedTime = minutesToTime(latestAllowedEnd)
    errors.push(`Break must end at least 15 minutes before shift ends (latest: ${latestAllowedTime})`)
  }

  // Check if start time is before end time
  if (breakStart >= breakEnd) {
    errors.push('Break start time must be before end time')
  }

  // Check if the valid time window is appropriate for the break type
  const expectedValidWindow = getBreakValidWindow(breakSlot.break_type)
  const actualValidWindow = breakEnd - breakStart
  
  if (actualValidWindow !== expectedValidWindow) {
    const expectedHours = Math.floor(expectedValidWindow / 60)
    const expectedMinutes = expectedValidWindow % 60
    const windowText = expectedHours > 0 ? `${expectedHours}h ${expectedMinutes}m` : `${expectedMinutes}m`
    errors.push(`${breakSlot.break_type} break should have a ${windowText} valid time window`)
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Validate that break times don't overlap with each other
 */
function validateNoOverlaps(breakSlots: BreakTimeSlot[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  for (let i = 0; i < breakSlots.length; i++) {
    for (let j = i + 1; j < breakSlots.length; j++) {
      const slot1 = breakSlots[i]
      const slot2 = breakSlots[j]
      
      const start1 = timeToMinutes(slot1.start_time)
      const end1 = timeToMinutes(slot1.end_time)
      const start2 = timeToMinutes(slot2.start_time)
      const end2 = timeToMinutes(slot2.end_time)
      
      if (timeRangesOverlap(start1, end1, start2, end2)) {
        errors.push(`${slot1.break_type} break (${slot1.start_time}-${slot1.end_time}) overlaps with ${slot2.break_type} break (${slot2.start_time}-${slot2.end_time})`)
      }
    }
  }
  
  return { isValid: errors.length === 0, errors }
}

/**
 * Main validation function for break scheduling
 */
export function validateBreakSchedule(
  breakSlots: BreakTimeSlot[],
  shiftTime: string
): BreakTimeValidation {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate each break against shift hours
  for (const breakSlot of breakSlots) {
    const shiftValidation = validateBreakAgainstShift(breakSlot, shiftTime)
    errors.push(...shiftValidation.errors)
  }

  // Validate no overlaps between breaks
  const overlapValidation = validateNoOverlaps(breakSlots)
  errors.push(...overlapValidation.errors)

  // Add warnings for potential issues
  if (breakSlots.length === 0) {
    warnings.push('No break times configured')
  }

  // Check for very short breaks
  for (const breakSlot of breakSlots) {
    if (breakSlot.duration_minutes < 5) {
      warnings.push(`${breakSlot.break_type} break duration is very short (${breakSlot.duration_minutes} minutes)`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Get available time slots for a break type within shift hours
 */
export function getAvailableTimeSlots(
  breakType: string,
  existingBreaks: BreakTimeSlot[],
  shiftTime: string,
  durationMinutes: number = 60
): { start: string; end: string }[] {
  const shiftTimes = parseShiftTimeToMinutes(shiftTime)
  if (!shiftTimes) return []

  const availableSlots: { start: string; end: string }[] = []
  const slotDuration = durationMinutes

  // Create a list of existing break times (excluding the current break type being edited)
  const otherBreaks = existingBreaks.filter(b => b.break_type !== breakType)
  const occupiedRanges = otherBreaks.map(b => ({
    start: timeToMinutes(b.start_time),
    end: timeToMinutes(b.end_time)
  }))

  // Sort occupied ranges by start time
  occupiedRanges.sort((a, b) => a.start - b.start)

  // Find gaps between occupied ranges
  let currentTime = shiftTimes.start
  
  for (const range of occupiedRanges) {
    // Check if there's a gap before this range
    if (currentTime + slotDuration <= range.start) {
      availableSlots.push({
        start: minutesToTime(currentTime),
        end: minutesToTime(currentTime + slotDuration)
      })
    }
    currentTime = Math.max(currentTime, range.end)
  }

  // Check if there's space after the last occupied range
  const shiftEnd = shiftTimes.isNightShift ? shiftTimes.end % (24 * 60) : shiftTimes.end
  if (currentTime + slotDuration <= shiftEnd) {
    availableSlots.push({
      start: minutesToTime(currentTime),
      end: minutesToTime(currentTime + slotDuration)
    })
  }

  return availableSlots
}

/**
 * Suggest optimal break times based on shift duration
 */
export function suggestOptimalBreakTimes(shiftTime: string): BreakTimeSlot[] {
  const shiftTimes = parseShiftTimeToMinutes(shiftTime)
  if (!shiftTimes) return []

  const shiftDuration = shiftTimes.end - shiftTimes.start
  const suggestions: BreakTimeSlot[] = []

  if (shiftDuration >= 4 * 60) { // 4+ hours
    // Morning break: 2 hours after start
    const morningStart = shiftTimes.start + (2 * 60)
    suggestions.push({
      break_type: 'Morning',
      start_time: minutesToTime(morningStart),
      end_time: minutesToTime(morningStart + 60), // 1 hour window
      duration_minutes: 15
    })
  }

  if (shiftDuration >= 6 * 60) { // 6+ hours
    // Lunch break: 4 hours after start
    const lunchStart = shiftTimes.start + (4 * 60)
    suggestions.push({
      break_type: 'Lunch',
      start_time: minutesToTime(lunchStart),
      end_time: minutesToTime(lunchStart + 60), // 1 hour window
      duration_minutes: 60
    })
  }

  if (shiftDuration >= 8 * 60) { // 8+ hours
    // Afternoon break: 7.75 hours after start
    const afternoonStart = shiftTimes.start + (7 * 60 + 45)
    suggestions.push({
      break_type: 'Afternoon',
      start_time: minutesToTime(afternoonStart),
      end_time: minutesToTime(afternoonStart + 60), // 1 hour window
      duration_minutes: 15
    })
  }

  return suggestions
}
