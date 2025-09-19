import { useState, useEffect, useCallback } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'

export interface Announcement {
  announcement_id: number
  title: string
  message: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  allow_dismiss: boolean
  created_at: string
  sent_at: string
  is_dismissed: boolean
  dismissed_at?: string
  expires_at?: string
}

export interface AnnouncementStats {
  total: number
  unread: number
  by_priority: Record<string, number>
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<AnnouncementStats | null>(null)

  // Fetch announcements from API
  const fetchAnnouncements = useCallback(async (includeDismissed = false) => {
    const currentUser = getCurrentUser()
    if (!currentUser?.id) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/announcements?user_id=${currentUser.id}&include_dismissed=${includeDismissed}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch announcements')
      }

      const data = await response.json()
      setAnnouncements(data.announcements || [])
      
      // Calculate stats
      const total = data.announcements?.length || 0
      const unread = data.announcements?.filter((a: Announcement) => !a.is_dismissed).length || 0
      
      const by_priority = data.announcements?.reduce((acc: Record<string, number>, a: Announcement) => {
        acc[a.priority] = (acc[a.priority] || 0) + 1
        return acc
      }, {}) || {}
      

      setStats({ total, unread, by_priority })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Dismiss an announcement
  const dismissAnnouncement = useCallback(async (announcementId: number, reason = 'user_dismissed') => {
    const currentUser = getCurrentUser()
    if (!currentUser?.id) return

    try {
      const response = await fetch('/api/announcements/dismiss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          announcement_id: announcementId,
          user_id: currentUser.id,
          dismissal_reason: reason
        })
      })

      if (!response.ok) {
        throw new Error('Failed to dismiss announcement')
      }

      // Update local state
      setAnnouncements(prev => 
        prev.map(a => 
          a.announcement_id === announcementId 
            ? { ...a, is_dismissed: true, dismissed_at: new Date().toISOString() }
            : a
        )
      )

      // Update stats
      setStats(prev => prev ? { ...prev, unread: Math.max(0, prev.unread - 1) } : null)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss announcement')
    }
  }, [])


  // Load announcements on mount and when user changes
  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  // Note: Auto-dismiss based on show_duration_seconds removed
  // Expiration is now handled by expires_at field and checked every 2 seconds below

  // Check for expired announcements every 5 seconds and refresh if needed
  // Load announcements on mount
  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  // Fallback: Check for expired announcements every 30 seconds (WebSocket should handle this)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      const hasExpiredAnnouncements = announcements.some(announcement => {
        if (!announcement.expires_at) return false
        const expiresAt = new Date(announcement.expires_at)
        return now >= expiresAt
      })
      
      if (hasExpiredAnnouncements) {
        fetchAnnouncements()
      }
    }, 30000) // Check every 30 seconds as fallback

    return () => clearInterval(interval)
  }, [announcements, fetchAnnouncements])

  // Get active (non-dismissed and not expired) announcements
  const activeAnnouncements = announcements.filter(a => {
    if (a.is_dismissed) return false
    
    // Check if announcement has expired
    if (a.expires_at) {
      const expiresAt = new Date(a.expires_at)
      const now = new Date()
      if (now >= expiresAt) {
        return false
      }
    }
    
    return true
  })

  // Debug logging
  useEffect(() => {
    if (announcements.length > 0) {
      announcements.forEach(ann => {
        const isExpired = ann.expires_at && new Date() >= new Date(ann.expires_at)
      })
    }
  }, [announcements, activeAnnouncements])

  // Get announcements by priority
  const getAnnouncementsByPriority = (priority: string) => 
    activeAnnouncements.filter(a => a.priority === priority)


  return {
    announcements: activeAnnouncements,
    allAnnouncements: announcements,
    loading,
    error,
    stats,
    dismissAnnouncement,
    fetchAnnouncements,
    getAnnouncementsByPriority,
    refetch: () => fetchAnnouncements()
  }
}
