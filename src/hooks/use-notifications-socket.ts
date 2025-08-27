"use client"

import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { getNotifications, saveNotifications } from '@/lib/notification-service'

type DbNotificationPayload = {
  id: number
  user_id: number
  category: string
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  message: string
  payload?: any
  created_at: string
  is_read?: boolean // Add is_read field from database
}

export function useNotificationsSocket(email: string | null) {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!email) return

    const socketServerUrl = (process.env.NEXT_PUBLIC_SOCKET_URL || process.env.SOCKET_SERVER_URL || 'http://localhost:3001') as string
      const socket = io(socketServerUrl, {
      reconnection: true,
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('authenticate', email)
    })

    const handleDbNotification = (n: DbNotificationPayload) => {
      const current = getNotifications()
      const notificationId = `db_${n.id}`
      
      // Check if this notification already exists to prevent duplicates
      const existingNotification = current.find(notif => notif.id === notificationId)
      if (existingNotification) {
        // If notification exists, only update if read status changed
        if (existingNotification.read !== !!n.is_read) {
          const updated = current.map(notif => 
            notif.id === notificationId 
              ? { ...notif, read: !!n.is_read }
              : notif
          )
          saveNotifications(updated)
          
          // Trigger update event with correct unread count
          if (typeof window !== 'undefined') {
            const unreadCount = updated.filter(n => !n.read).length
            window.dispatchEvent(new CustomEvent('notifications-updated', {
              detail: { unreadCount }
            }))
          }
        }
        return // Skip adding duplicate
      }
      
      const payload = n.payload || {}
      const actionUrl = (() => {
        if (n.category === 'ticket' && (payload.ticket_id || payload.ticket_row_id)) {
          return `/forms/${payload.ticket_id || ''}`
        }
        if (n.category === 'break') return '/status/breaks'
        if (n.category === 'task') {
          // For task notifications, include the task_id if available
          if (payload.task_id) {
            return `/productivity/task-activity?taskId=${payload.task_id}`
          }
          return '/productivity/task-activity'
        }
        return undefined
      })()
      const icon = (() => {
        if (n.category === 'ticket') return 'FileText' as const
        if (n.category === 'break') return 'Clock' as const
        if (n.category === 'task') return 'CheckSquare' as const
        return 'Bell' as const
      })()
      const mapped = {
        id: notificationId,
        type: n.type,
        title: n.title,
        message: n.message,
        time: (require('@/lib/notification-service') as any).parseDbTimestampToMs(n.created_at, n.category),
        read: !!n.is_read, // Use database read status instead of always false
        icon,
        actionUrl,
        actionData: payload,
        category: (n.category as any) || 'system',
        priority: 'medium' as const,
        eventType: 'system' as const,
      }
      
      // Add new notification to the beginning and limit to 50
      const updatedNotifications = [mapped, ...current].slice(0, 50)
      saveNotifications(updatedNotifications)
      
      if (typeof window !== 'undefined') {
        // Trigger update event with correct unread count
        const unreadCount = updatedNotifications.filter(n => !n.read).length
        window.dispatchEvent(new CustomEvent('notifications-updated', {
          detail: { unreadCount }
        }))
        
        if (window.electronAPI?.systemNotifications) {
          try {
            window.electronAPI.systemNotifications.show({
              title: mapped.title,
              message: mapped.message,
              actionUrl: mapped.actionUrl,
              id: mapped.id,
            })
            // Mark as read when Electron notifies us the user clicked a system notification
            window.electronAPI.receive?.('mark-notification-read', (notifId: string) => {
              if (notifId === mapped.id) {
                const updated = getNotifications().map(n => n.id === notifId ? { ...n, read: true } : n)
                saveNotifications(updated)
                
                // Trigger update event with correct unread count
                const unreadCount = updated.filter(n => !n.read).length
                window.dispatchEvent(new CustomEvent('notifications-updated', {
                  detail: { unreadCount }
                }))
                
                // Persist read state in DB
                const email = (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('shoreagents-auth') || '{}')?.user?.email : null) || null
                if (email) {
                  fetch('/api/notifications/mark-read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ id: notifId, email })
                  }).catch(() => {})
                }
              }
            })
          } catch {}
        }
      }
    }

    socket.on('db-notification', handleDbNotification)

    return () => {
      try {
        socket.off('db-notification', handleDbNotification)
        socket.disconnect()
      } catch {}
      socketRef.current = null
    }
  }, [email])
}


