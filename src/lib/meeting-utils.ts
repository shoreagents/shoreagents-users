// Meeting API utility functions

import { getCurrentUserInfo } from './user-profiles'

// Utility function to update meeting status via Socket.IO
export const updateMeetingStatus = (isInMeeting: boolean) => {
  // Try to get the Socket.IO instance from the window object
  // This assumes the socket is stored globally by the meeting status hook
  if (typeof window !== 'undefined' && (window as any).meetingSocket) {
    const socket = (window as any).meetingSocket
    socket.emit('updateMeetingStatus', isInMeeting)
  } else {
    console.warn('⚠️ Socket.IO not available for meeting status update')
  }
}

export interface Meeting {
  id: number
  title: string
  description: string
  start_time: string
  end_time: string
  duration_minutes: number
  meeting_type: 'video' | 'audio' | 'in-person'
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'
  is_in_meeting: boolean
  actual_start_time?: string
  created_at: string
}

export interface MeetingStatistics {
  total_meetings: number
  completed_meetings: number
  cancelled_meetings: number
  total_duration_minutes: number
  avg_duration_minutes: number
  today_meetings: number
  today_duration_minutes: number
}

export interface MeetingStatus {
  statistics: MeetingStatistics
  activeMeeting: Meeting | null
  isInMeeting: boolean
}

// Get user's meetings
export const getMeetings = async (days: number = 7): Promise<Meeting[]> => {
  const currentUser = getCurrentUserInfo()
  if (!currentUser?.id) {
    throw new Error('User not authenticated')
  }

  const response = await fetch(`/api/meetings?agent_user_id=${currentUser.id}&days=${days}`)
  if (!response.ok) {
    throw new Error('Failed to fetch meetings')
  }
  const data = await response.json()
  return data.meetings || []
}

// Create a new meeting
export const createMeeting = async (meetingData: {
  title: string
  description?: string
  duration: number
  type: 'video' | 'audio' | 'in-person'
}): Promise<Meeting> => {
  const currentUser = getCurrentUserInfo()
  if (!currentUser?.id) {
    throw new Error('User not authenticated')
  }

  const response = await fetch('/api/meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_user_id: currentUser.id,
      ...meetingData
    })
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create meeting')
  }
  const data = await response.json()
  return data.meeting
}

// Start a meeting
export const startMeeting = async (meetingId: number): Promise<void> => {
  const response = await fetch('/api/meetings/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId })
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to start meeting')
  }
  
  // Update meeting status via Socket.IO
  updateMeetingStatus(true)
}

// End a meeting
export const endMeeting = async (meetingId: number): Promise<void> => {
  const response = await fetch('/api/meetings/end', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId })
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to end meeting')
  }
  
  // Update meeting status via Socket.IO
  updateMeetingStatus(false)
}

// Cancel a meeting
export const cancelMeeting = async (meetingId: number): Promise<void> => {
  const response = await fetch('/api/meetings/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId })
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to cancel meeting')
  }
  
  // Update meeting status via Socket.IO
  updateMeetingStatus(false)
}

// Get meeting status and statistics
export const getMeetingStatus = async (days: number = 7): Promise<MeetingStatus> => {
  const currentUser = getCurrentUserInfo()
  if (!currentUser?.id) {
    throw new Error('User not authenticated')
  }

  const response = await fetch(`/api/meetings/status?agent_user_id=${currentUser.id}&days=${days}`)
  if (!response.ok) {
    throw new Error('Failed to fetch meeting status')
  }
  const data = await response.json()
  return data
}

// Check if user has an ongoing meeting (in-progress)
export const hasOngoingMeeting = async (): Promise<boolean> => {
  try {
    const meetings = await getMeetings()
    return meetings.some((meeting: Meeting) => meeting.status === 'in-progress')
  } catch (error) {
    console.error('Error checking for ongoing meetings:', error)
    return false
  }
}

// Check if user has any scheduled meetings that haven't started yet
export const hasScheduledMeeting = async (): Promise<boolean> => {
  try {
    const meetings = await getMeetings()
    return meetings.some((meeting: Meeting) => meeting.status === 'scheduled')
  } catch (error) {
    console.error('Error checking for scheduled meetings:', error)
    return false
  }
}

// Check if user can create a new meeting (no ongoing or scheduled meetings)
export const canCreateMeeting = async (): Promise<{ canCreate: boolean; reason?: string }> => {
  try {
    const ongoingMeeting = await hasOngoingMeeting()
    const scheduledMeeting = await hasScheduledMeeting()
    
    if (ongoingMeeting) {
      return { canCreate: false, reason: 'You have an ongoing meeting. Please end it before creating a new one.' }
    }
    
    if (scheduledMeeting) {
      return { canCreate: false, reason: 'You have a scheduled meeting that hasn\'t started yet. Please start or cancel it before creating a new one.' }
    }
    
    return { canCreate: true }
  } catch (error) {
    console.error('Error checking if can create meeting:', error)
    return { canCreate: false, reason: 'Error checking meeting status. Please try again.' }
  }
} 