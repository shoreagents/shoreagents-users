"use client"

import { getCurrentUser } from '@/lib/ticket-utils'
import { startMeeting } from '@/hooks/use-meetings'
import { showNotification } from '@/lib/notification-service'

interface ScheduledMeeting {
  id: number
  title: string
  start_time: string
  status: string
}

class MeetingScheduler {
  private checkInterval: NodeJS.Timeout | null = null
  private notificationSent: Set<number> = new Set()
  private readonly CHECK_INTERVAL = 30000 // Check every 30 seconds
  private readonly REMINDER_TIME = 60 * 60 * 1000 // 1 hour in milliseconds

  constructor() {
    this.startScheduler()
  }

  private startScheduler() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    this.checkInterval = setInterval(() => {
      this.checkScheduledMeetings()
    }, this.CHECK_INTERVAL)
  }

  private async checkScheduledMeetings() {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser?.id) return

      // Fetch scheduled meetings
      const response = await fetch(`/api/meetings?agent_user_id=${currentUser.id}&days=7`, {
        credentials: 'include'
      })

      if (!response.ok) return

      const data = await response.json()
      const scheduledMeetings = data.meetings?.filter((meeting: ScheduledMeeting) => 
        meeting.status === 'scheduled'
      ) || []

      const now = new Date()

      for (const meeting of scheduledMeetings) {
        const meetingStartTime = new Date(meeting.start_time)
        const timeUntilStart = meetingStartTime.getTime() - now.getTime()

        // Check for 1-hour reminder
        if (timeUntilStart <= this.REMINDER_TIME && timeUntilStart > 0) {
          this.sendReminderNotification(meeting)
        }

        // Check if it's time to start the meeting (within 1 minute of scheduled time)
        if (timeUntilStart <= 60000 && timeUntilStart > -60000) {
          await this.startScheduledMeeting(meeting)
        }
      }
    } catch (error) {
      console.error('Error checking scheduled meetings:', error)
    }
  }

  private sendReminderNotification(meeting: ScheduledMeeting) {
    const notificationKey = `meeting-reminder-${meeting.id}`
    
    if (this.notificationSent.has(meeting.id)) return

    showNotification({
      title: 'Meeting Reminder',
      message: `"${meeting.title}" starts in 1 hour`,
      type: 'info',
      duration: 10000
    })

    this.notificationSent.add(meeting.id)
  }

  private async startScheduledMeeting(meeting: ScheduledMeeting) {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser?.id) return

      // Start the meeting
      const response = await fetch('/api/meetings/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          meetingId: meeting.id,
          agent_user_id: currentUser.id
        })
      })

      if (response.ok) {
        // Show notification that meeting has started
        showNotification({
          title: 'Meeting Started',
          message: `"${meeting.title}" has started automatically`,
          type: 'success',
          duration: 8000
        })

        // Remove from notification sent set so reminder can be sent again for future meetings
        this.notificationSent.delete(meeting.id)
      }
    } catch (error) {
      console.error('Error starting scheduled meeting:', error)
      
      showNotification({
        title: 'Meeting Start Failed',
        message: `Failed to start "${meeting.title}" automatically`,
        type: 'error',
        duration: 8000
      })
    }
  }

  public stopScheduler() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  public resetNotifications() {
    this.notificationSent.clear()
  }
}

// Create a singleton instance
let meetingScheduler: MeetingScheduler | null = null

export function initializeMeetingScheduler() {
  if (!meetingScheduler) {
    meetingScheduler = new MeetingScheduler()
  }
  return meetingScheduler
}

export function getMeetingScheduler() {
  return meetingScheduler
}

export function stopMeetingScheduler() {
  if (meetingScheduler) {
    meetingScheduler.stopScheduler()
    meetingScheduler = null
  }
}
