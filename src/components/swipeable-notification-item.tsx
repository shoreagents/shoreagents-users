"use client"

import React, { useState, useRef, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Trash2, X } from 'lucide-react'
import { formatTimeAgo } from '@/lib/notification-service'

interface SwipeableNotificationItemProps {
  notification: any
  onMarkAsRead: (notificationId: number) => Promise<void>
  onDelete: (notificationId: number) => Promise<void>
  onNavigate?: (actionUrl: string) => void
  getIconComponent: (iconName: string) => any
  truncateNotificationMessage: (message: string, maxLength?: number) => string
  nowTick: number
}

export function SwipeableNotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onNavigate,
  getIconComponent,
  truncateNotificationMessage,
  nowTick
}: SwipeableNotificationItemProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragCurrentX, setDragCurrentX] = useState(0)
  const [isSwipeRevealed, setIsSwipeRevealed] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeletingAnimation, setIsDeletingAnimation] = useState(false)
  const [dragProgress, setDragProgress] = useState(0) // 0-1 progress towards threshold
  
  const containerRef = useRef<HTMLDivElement>(null)
  const dragThreshold = 60 // Minimum distance to reveal action buttons
  const maxSwipeDistance = 160 // Maximum swipe distance (increased for both buttons)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsDragging(true)
    setDragStartX(e.clientX)
    setDragCurrentX(e.clientX)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    
    e.preventDefault()
    const deltaX = e.clientX - dragStartX
    const newX = Math.max(-maxSwipeDistance, Math.min(0, deltaX))
    setDragCurrentX(newX)
    
    // Calculate drag progress (0-1)
    const progress = Math.min(Math.abs(deltaX) / dragThreshold, 1)
    setDragProgress(progress)
    
    // Update transform
    if (containerRef.current) {
      containerRef.current.style.transform = `translateX(${newX}px)`
    }
  }, [isDragging, dragStartX, maxSwipeDistance, dragThreshold])

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return
    
    setIsDragging(false)
    
    const deltaX = dragCurrentX - dragStartX
    const shouldReveal = Math.abs(deltaX) > dragThreshold
    
    if (shouldReveal) {
      setIsSwipeRevealed(true)
      if (containerRef.current) {
        containerRef.current.style.transform = 'translateX(-160px)'
      }
    } else {
      // Snap back
      setIsSwipeRevealed(false)
      if (containerRef.current) {
        containerRef.current.style.transform = 'translateX(0)'
      }
    }
    
    setDragCurrentX(0)
    setDragProgress(0)
  }, [isDragging, dragCurrentX, dragStartX, dragThreshold])

  const handleCancel = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsSwipeRevealed(false)
    setDragProgress(0)
    if (containerRef.current) {
      containerRef.current.style.transform = 'translateX(0)'
    }
  }, [])

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    
    if (isDeleting || isDeletingAnimation) {
      return
    }
    
    setIsDeleting(true)
    setIsDeletingAnimation(true)
    
    // Start the slide-out animation immediately
    if (containerRef.current) {
      containerRef.current.style.transform = 'translateX(-100%) scale(0.95)'
      containerRef.current.style.opacity = '0'
      containerRef.current.style.transition = 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out'
    }
    
    try {
      // Extract the numeric ID from the db_ prefix
      let notificationId: number
      const idStr = notification.id.toString()
      if (idStr.startsWith('db_')) {
        notificationId = parseInt(idStr.slice(3))
      } else {
        notificationId = parseInt(idStr)
      }
      
      
      if (!isNaN(notificationId)) {
        // Wait for animation to complete before calling onDelete
        await new Promise(resolve => setTimeout(resolve, 300))
        
        await onDelete(notificationId)
        
        // Reset swipe state after successful deletion
        setIsSwipeRevealed(false)
        setDragProgress(0)
      } else {
        console.error('Invalid notification ID:', notificationId)
        // Reset animation state on error
        setIsDeletingAnimation(false)
        if (containerRef.current) {
          containerRef.current.style.transform = 'translateX(0) scale(1)'
          containerRef.current.style.opacity = '1'
          containerRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
      // Reset animation state on error
      setIsDeletingAnimation(false)
      if (containerRef.current) {
        containerRef.current.style.transform = 'translateX(0) scale(1)'
        containerRef.current.style.opacity = '1'
        containerRef.current.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
      }
    } finally {
      setIsDeleting(false)
    }
  }, [notification.id, onDelete, isDeleting, isDeletingAnimation])

  const handleNotificationClick = useCallback(async (e: React.MouseEvent) => {
    // Don't trigger click if we were dragging or deleting
    if (isDragging || isSwipeRevealed || isDeletingAnimation) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    
    try {
      // Extract the numeric ID from the db_ prefix
      let notificationId: number
      const idStr = notification.id.toString()
      if (idStr.startsWith('db_')) {
        notificationId = parseInt(idStr.slice(3))
      } else {
        notificationId = parseInt(idStr)
      }
      
      if (!isNaN(notificationId)) {
        await onMarkAsRead(notificationId)
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
    
    // Navigate if actionUrl is provided
    let actionUrl = notification.actionUrl || notification.actionData?.action_url
    
    
    // For task notifications, ensure taskId is included in the URL
    if (notification.category === 'task' && notification.actionData?.task_id && actionUrl) {
      // Check if taskId is already in the URL
      if (!actionUrl.includes('taskId=')) {
        const separator = actionUrl.includes('?') ? '&' : '?'
        actionUrl = `${actionUrl}${separator}taskId=${notification.actionData.task_id}`
      }
    }
    
    if (actionUrl && onNavigate) {
      onNavigate(actionUrl)
    } 
  }, [notification, onMarkAsRead, onNavigate, isDragging, isSwipeRevealed, isDeletingAnimation])

  // Add global mouse event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Reset swipe state when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isSwipeRevealed && containerRef.current) {
        const target = e.target as Node
        const isInsideContainer = containerRef.current.contains(target)
        const isActionButton = target instanceof Element && (
          target.closest('[data-action="delete"]') || 
          target.closest('[data-action="cancel"]')
        )
        
        // Only close if clicking outside the container AND not on action buttons
        if (!isInsideContainer && !isActionButton) {
          setIsSwipeRevealed(false)
          setDragProgress(0)
          if (containerRef.current) {
            containerRef.current.style.transform = 'translateX(0)'
          }
        }
      }
    }

    if (isSwipeRevealed) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isSwipeRevealed])

  const IconComponent = getIconComponent(notification.icon)

  return (
    <>
      <div className="relative overflow-hidden rounded-md">
        {/* Swipeable Content Container */}
        <div
          ref={containerRef}
          className={`relative transition-transform duration-200 ease-out ${
            isDragging ? 'cursor-grabbing' : 'cursor-pointer'
          } ${isDeletingAnimation ? 'opacity-0' : ''}`}
          onMouseDown={handleMouseDown}
          onClick={handleNotificationClick}
          style={{
            transform: isSwipeRevealed ? 'translateX(-160px)' : 'translateX(0)',
            transition: isDragging ? 'none' : (isDeletingAnimation ? 'transform 0.3s ease-in-out, opacity 0.3s ease-in-out' : 'transform 0.2s ease-out')
          }}
        >
          {/* Main Notification Content */}
          <div className="flex items-center gap-3 w-full min-w-0 p-4">
            <div className={`flex-shrink-0 ${
              notification.type === 'success' ? 'text-green-600 dark:text-green-400' :
              notification.type === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
              notification.type === 'error' ? 'text-red-600 dark:text-red-400' :
              'text-blue-600 dark:text-blue-400'
            }`}>
              <IconComponent className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="space-y-1">
                <h4 className={`text-sm font-medium leading-tight ${
                  !notification.read ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {notification.title}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {truncateNotificationMessage(notification.message)}
                </p>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span key={nowTick} className="text-xs text-muted-foreground">
                    {formatTimeAgo(notification.time)}
                  </span>
                  {!notification.read && (
                    <Badge variant="destructive" className="text-xs bg-red-500 text-white flex-shrink-0">
                      New
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons - Only show when swiped */}
          {isSwipeRevealed && (
            <div className="absolute left-full top-0 h-full w-40 flex">
              {/* Cancel Button Area */}
              <div className="w-20 h-full bg-gray-500 flex items-center justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full bg-gray-600 hover:bg-gray-700"
                  onMouseDown={handleCancel}
                  data-action="cancel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Delete Button Area */}
              <div className="w-20 h-full bg-red-500 flex items-center justify-center">
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-full bg-red-600 hover:bg-red-700"
                  onMouseDown={handleDelete}
                  disabled={isDeleting}
                  data-action="delete"
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Separator />
    </>
  )
}
