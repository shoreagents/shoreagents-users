import { useState, useEffect, useCallback } from 'react'
import { useSocket } from '@/contexts/socket-context'

export interface DbNotificationPayload {
  id: number
  user_id: number
  category: string
  type: string
  title: string
  message: string
  payload?: any
  is_read: boolean
  created_at: string
  updated_at: string
}

export function useNotificationsSocketContext(email: string | null) {
  const { socket, isConnected } = useSocket()
  const [notifications, setNotifications] = useState<DbNotificationPayload[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Set up socket event listeners when socket is available
  useEffect(() => {
    if (!socket || !email) return

    // Listen for notification updates
    const handleNotificationUpdate = (data: any) => {
      // Check if this notification is for the current user
      if (data.email === email || data.user_id) {
        // Handle raw notification data from database (sent via db-notification event)
        if (data.id && data.title && data.message) {
          // Check if notification already exists to avoid duplicates
          setNotifications(prev => {
            const exists = prev.some(n => n.id === data.id)
            if (!exists) {
              return [data, ...prev]
            } else {
              return prev
            }
          })
          
          // Update unread count
          setUnreadCount(prev => prev + 1)
          
          // Show system notification if permission granted
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(data.title, {
              body: data.message,
              icon: '/shoreagents-logo.png',
              tag: `notification-${data.id}`,
              requireInteraction: false
            })
          }
        } else if (data.type === 'notification_read') {
          const { notification_id } = data
          setNotifications(prev => 
            prev.map(n => n.id === notification_id ? { ...n, is_read: true } : n)
          )
          setUnreadCount(prev => Math.max(0, prev - 1))
        } else if (data.type === 'notification_deleted') {
          const { notification_id } = data
          setNotifications(prev => prev.filter(n => n.id !== notification_id))
          // Recalculate unread count
          setUnreadCount(prev => {
            const deletedNotification = notifications.find(n => n.id === notification_id)
            return deletedNotification && !deletedNotification.is_read ? Math.max(0, prev - 1) : prev
          })
        }
      }
    }

    // Listen for notification events
    socket.on('db-notification', handleNotificationUpdate)

    // Clean up event listeners
    return () => {
      socket.off('db-notification', handleNotificationUpdate)
    }
  }, [socket, email, notifications])

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (userId: number, limit: number = 8, offset: number = 0) => {
    try {
      if (!email) {
        console.error('Email is required to fetch notifications')
        return
      }
      
      const response = await fetch(`/api/notifications?email=${encodeURIComponent(email)}&limit=${limit}`)
      const data = await response.json()
      
      if (data.success) {
        setNotifications(data.notifications || [])
        // Use totalUnreadCount from API response instead of calculating from limited notifications
        // Ensure it's converted to a number to prevent string concatenation issues
        const unreadCount = Number(data.totalUnreadCount) || 0
        setUnreadCount(unreadCount)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }, [email])

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: number) => {
    try {
      const response = await fetch(`/api/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: notificationId,
          email: email 
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        )
        setUnreadCount(prev => Math.max(0, prev - 1))
        
        // Emit to socket server if connected
        if (socket && isConnected) {
          socket.emit('notification-read', {
            email,
            notification_id: notificationId
          })
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [socket, isConnected, email])

  // Mark all notifications as read
  const markAllAsRead = useCallback(async (userId: number, notificationIds?: number[]) => {
    try {
      let unreadIds: number[]
      
      if (notificationIds) {
        // Use provided notification IDs
        unreadIds = notificationIds
      } else {
        // Fetch ALL unread notification IDs from the database, not just the loaded ones
        const response = await fetch(`/api/notifications?email=${encodeURIComponent(email || '')}&limit=1000&offset=0`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          unreadIds = data.notifications
            .filter((n: any) => !n.is_read)
            .map((n: any) => n.id)
        } else {
          // Fallback to loaded notifications if API fails
          unreadIds = notifications
            .filter(n => !n.is_read)
            .map(n => n.id)
        }
      }
      
      if (unreadIds.length === 0) {
        return // No unread notifications to mark
      }
      const response = await fetch(`/api/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ids: unreadIds,
          email: email 
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnreadCount(0)
        
        // Emit to socket server if connected
        if (socket && isConnected) {
          socket.emit('notifications-all-read', {
            email,
            user_id: userId
          })
        }
      } else {
        console.error('Failed to mark notifications as read:', data.error)
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }, [socket, isConnected, email, notifications])

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: number) => {
    try {
      const response = await fetch(`/api/notifications/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: notificationId,
          email: email 
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        const deletedNotification = notifications.find(n => n.id === notificationId)
        setNotifications(prev => prev.filter(n => n.id !== notificationId))
        
        // Update unread count if deleted notification was unread
        if (deletedNotification && !deletedNotification.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
        
        // Emit to socket server if connected
        if (socket && isConnected) {
          socket.emit('notification-deleted', {
            email,
            notification_id: notificationId
          })
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }, [socket, isConnected, email, notifications])

  // Clear all notifications
  const clearAll = useCallback(async (notificationIds: number[]) => {
    try {
      // Always clear the state first for immediate UI update
      setNotifications([])
      setUnreadCount(0)
      
      if (notificationIds.length === 0) {
        // If no IDs provided, just clear state
        return
      }

      const response = await fetch(`/api/notifications/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ids: notificationIds,
          email: email 
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Emit to socket server if connected
        if (socket && isConnected) {
          socket.emit('notifications-cleared', {
            email,
            user_id: notificationIds.length > 0 ? notificationIds[0] : null // Use first ID as user reference
          })
        }
        
        // Dispatch custom event to notify other components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('notifications-updated', {
            detail: { unreadCount: 0 }
          }))
        }
      } else {
        // If API call failed, we might want to restore the state
        console.error('Failed to clear notifications from database:', data.error)
      }
    } catch (error) {
      console.error('Error clearing all notifications:', error)
    }
  }, [socket, isConnected, email])

  return {
    isConnected,
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  }
}