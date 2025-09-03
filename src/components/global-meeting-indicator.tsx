"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useMeeting } from '@/contexts/meeting-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Video, 
  Phone, 
  PhoneOff, 
  Clock,
  Users,
  AlertCircle,
  Move
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface GlobalMeetingIndicatorProps {
  className?: string
}

export function GlobalMeetingIndicator({ className }: GlobalMeetingIndicatorProps) {
  const { isInMeeting, currentMeeting, endCurrentMeeting, isLoading } = useMeeting()
  const [isEnding, setIsEnding] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [position, setPosition] = useState({ x: 24, y: 24 }) // Default top-right position
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Load position from localStorage on component mount
  useEffect(() => {
    const savedPosition = localStorage.getItem('meeting-indicator-position')
    if (savedPosition) {
      try {
        const parsedPosition = JSON.parse(savedPosition)
        // Validate that the position is within reasonable bounds
        const maxX = window.innerWidth - 288 // Component width
        const maxY = window.innerHeight - 200 // Component height
        
        if (
          parsedPosition.x >= 0 && 
          parsedPosition.y >= 0 && 
          parsedPosition.x <= maxX && 
          parsedPosition.y <= maxY
        ) {
          setPosition(parsedPosition)
        } else {
          // Reset to default if saved position is out of bounds
          console.log('Saved position is out of bounds, resetting to default')
          setPosition({ x: 24, y: 24 })
          savePosition({ x: 24, y: 24 })
        }
      } catch (error) {
        console.warn('Failed to parse saved meeting indicator position:', error)
        // Reset to default on parse error
        setPosition({ x: 24, y: 24 })
        savePosition({ x: 24, y: 24 })
      }
    }
  }, [])

  // Save position to localStorage whenever it changes
  const savePosition = useCallback((newPosition: { x: number; y: number }) => {
    try {
      localStorage.setItem('meeting-indicator-position', JSON.stringify(newPosition))
    } catch (error) {
      console.warn('Failed to save meeting indicator position:', error)
    }
  }, [])

  // Update time every second for real-time duration
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('[data-draggable="false"]')) {
      return // Don't drag if clicking on non-draggable elements
    }
    
    setIsDragging(true)
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return

    const newX = e.clientX - dragOffset.x
    const newY = e.clientY - dragOffset.y

    // Keep within viewport bounds
    const maxX = window.innerWidth - 288 // Component width (w-72 = 288px)
    const maxY = window.innerHeight - 200 // Component height

    const newPosition = {
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    }

    setPosition(newPosition)
  }

  const handleMouseUp = () => {
    if (isDragging) {
      // Save position when dragging ends
      savePosition(position)
    }
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    } else {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, dragOffset])

  // Don't render if not in a meeting or if we're still loading and there's no indication of an active meeting
  // Only show loading state if we have some indication there might be an active meeting
  if (!isInMeeting || !currentMeeting) {
    // If we're loading but have no meeting data yet, don't show anything
    // This prevents the loading indicator from showing when there are no meetings
    return null
  }

  const handleEndMeeting = async () => {
    if (isEnding) return
    
    setIsEnding(true)
    try {
      const result = await endCurrentMeeting()
      if (!result.success) {
        console.error('Failed to end meeting:', result.message)
        // You could add a toast notification here
        alert(`Failed to end meeting: ${result.message}`)
      }
    } catch (error) {
      console.error('Error ending meeting:', error)
      alert('An unexpected error occurred while ending the meeting')
    } finally {
      setIsEnding(false)
    }
  }

  const getMeetingTypeIcon = (meetingType: string) => {
    switch (meetingType?.toLowerCase()) {
      case 'video':
        return <Video className="h-4 w-4" />
      case 'phone':
        return <Phone className="h-4 w-4" />
      case 'in-person':
        return <Users className="h-4 w-4" />
      default:
        return <Video className="h-4 w-4" />
    }
  }

  const getMeetingTypeColor = (meetingType: string) => {
    switch (meetingType?.toLowerCase()) {
      case 'video':
        return 'bg-gradient-to-br from-blue-500 to-blue-600'
      case 'phone':
        return 'bg-gradient-to-br from-emerald-500 to-emerald-600'
      case 'in-person':
        return 'bg-gradient-to-br from-purple-500 to-purple-600'
      default:
        return 'bg-gradient-to-br from-blue-500 to-blue-600'
    }
  }

  const formatMeetingDuration = (startTime: string) => {
    const start = new Date(startTime)
    const diffMs = currentTime.getTime() - start.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const remainingMins = diffMins % 60

    if (diffHours > 0) {
      return `${diffHours}h ${remainingMins}m`
    }
    return `${diffMins}m`
  }

  return (
    <div 
      ref={containerRef}
      className={cn(
        "fixed z-50 w-72 cursor-grab select-none",
        "bg-white/95 dark:bg-gray-900/95 backdrop-blur-md",
        "border border-gray-200/50 dark:border-gray-700/50",
        "rounded-xl shadow-xl shadow-black/10 dark:shadow-black/30",
        "animate-in slide-in-from-top-2 fade-in duration-500",
        "ring-1 ring-gray-200/20 dark:ring-gray-700/20",
        "transition-shadow duration-200",
        isDragging && "shadow-2xl cursor-grabbing",
        className
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header with gradient background */}
      <div className="relative bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-t-xl p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-2 rounded-lg text-white shadow-md",
              "bg-white/20 backdrop-blur-sm border border-white/30",
              getMeetingTypeColor(currentMeeting.meeting_type || 'video')
            )}>
              {getMeetingTypeIcon(currentMeeting.meeting_type || 'video')}
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">
                In Meeting
              </h3>
              <p className="text-blue-100 text-xs font-medium">
                {currentMeeting.meeting_type || 'video'} call
              </p>
            </div>
          </div>
          
          {/* Live indicator with enhanced styling */}
          <div className="flex items-center gap-1.5 bg-red-500/20 backdrop-blur-sm rounded-full px-2 py-1 border border-red-400/30">
            <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse shadow-md shadow-red-400/50"></div>
            <span className="text-red-100 text-xs font-bold tracking-wide">
              LIVE
            </span>
          </div>
        </div>
        
        {/* Drag handle */}
        <div className="absolute top-1 right-1 opacity-30 hover:opacity-60 transition-opacity">
          <Move className="h-3 w-3 text-white" />
        </div>
      </div>

      {/* Content area */}
      <div className="p-3">
        {/* Meeting Details */}
        <div className="mb-3">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1 leading-tight">
            {currentMeeting.title}
          </h4>
          {currentMeeting.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 leading-relaxed">
              {currentMeeting.description}
            </p>
          )}
        </div>

        {/* Duration and Status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-md px-2 py-1.5">
            <Clock className="h-3 w-3 text-gray-500 dark:text-gray-400" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {formatMeetingDuration(currentMeeting.start_time)}
            </span>
          </div>
          
          <Badge 
            variant="secondary" 
            className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50 font-medium px-2 py-0.5 text-xs"
          >
            Active
          </Badge>
        </div>

        {/* End Meeting Button */}
        <Button
          onClick={handleEndMeeting}
          disabled={isEnding || isLoading}
          variant="destructive"
          size="sm"
          data-draggable="false"
          className="w-full h-9 bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 border-0 text-sm"
        >
          {isEnding ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              <span className="text-sm">Ending...</span>
            </>
          ) : (
            <>
              <PhoneOff className="h-4 w-4 mr-2" />
              <span className="text-sm">End Meeting</span>
            </>
          )}
        </Button>

        {/* Warning for long meetings */}
        {currentMeeting.start_time && (() => {
          const start = new Date(currentMeeting.start_time)
          const now = new Date()
          const diffHours = (now.getTime() - start.getTime()) / (1000 * 60 * 60)
          
          if (diffHours > 2) {
            return (
              <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                    Meeting running over 2 hours
                  </span>
                </div>
              </div>
            )
          }
          return null
        })()}
      </div>

      {/* Subtle bottom border accent */}
      <div className="h-0.5 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-b-xl"></div>
    </div>
  )
}
