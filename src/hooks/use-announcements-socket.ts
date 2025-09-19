import { useEffect, useRef } from 'react'
import { useSocket } from '@/contexts/socket-context'
import { useAnnouncementsContext } from '@/contexts/announcements-context'

export function useAnnouncementsSocket() {
  const { socket, isConnected } = useSocket()
  const { fetchAnnouncements, dismissAnnouncement } = useAnnouncementsContext()
  const lastProcessedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!socket || !isConnected) return

    const handleAnnouncementNotification = async (data: any) => {

      // Prevent duplicate processing
      const notificationId = `${data.type}_${data.announcement_id}_${data.user_id || 'global'}`
      if (lastProcessedRef.current.has(notificationId)) {
        return
      }
      lastProcessedRef.current.add(notificationId)

      // Clean up old processed notifications (keep last 100)
      if (lastProcessedRef.current.size > 100) {
        const toDelete = Array.from(lastProcessedRef.current).slice(0, 50)
        toDelete.forEach(id => lastProcessedRef.current.delete(id))
      }

      switch (data.type) {
        case 'announcement_sent':
          // New announcement sent to user
          if (data.user_id) {
            // Refresh announcements
            await fetchAnnouncements()
          }
          break

        case 'announcement_dismissed':
          // Announcement was dismissed
          if (data.user_id) {
            // Update local state without refetching
          }
          break

        case 'announcement_expired':
          // Announcement has expired
          await fetchAnnouncements()
          break

        case 'announcement_change':
          // Announcement was created, updated, or deleted
          await fetchAnnouncements()
          break

        default:
          // Unknown notification type
      }
    }

    // Listen for announcement notifications
    socket.on('announcement', handleAnnouncementNotification)

    // Also listen for database notifications (fallback)
    socket.on('db-notification', (data: any) => {
      if (data.category === 'announcement') {
        handleAnnouncementNotification(data)
      }
    })

    // Clean up event listeners
    return () => {
      socket.off('announcement', handleAnnouncementNotification)
      socket.off('db-notification', handleAnnouncementNotification)
    }
  }, [socket, isConnected, fetchAnnouncements, dismissAnnouncement])


  return {
    isConnected
  }
}
