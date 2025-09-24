"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMeeting } from '@/contexts/meeting-context'
import { useSocket } from '@/contexts/socket-context'
import { Button } from '@/components/ui/button'
import { 
  Video, 
  Phone, 
  PhoneOff, 
  Clock,
  Users,
  AlertCircle,
  Move,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface GlobalMeetingIndicatorProps {
  className?: string
}

export const GlobalMeetingIndicator = React.memo(function GlobalMeetingIndicator({ className }: GlobalMeetingIndicatorProps) {
  const { 
    endCurrentMeeting, 
    isInMeeting, 
    currentMeeting, 
    isLoading 
  } = useMeeting()
  const { socket, isConnected } = useSocket()
  const [isEnding, setIsEnding] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [position, setPosition] = useState({ x: 24, y: 24 }) // Default top-right position
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isMinimized, setIsMinimized] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Save position to localStorage whenever it changes
  const savePosition = useCallback((newPosition: { x: number; y: number }) => {
    try {
      localStorage.setItem('meeting-indicator-position', JSON.stringify(newPosition))
    } catch (error) {
      console.warn('Failed to save meeting indicator position:', error)
    }
  }, [])

  // Load position from localStorage on component mount with improved validation
  useEffect(() => {
    const savedPosition = localStorage.getItem('meeting-indicator-position')
    if (savedPosition) {
      try {
        const parsedPosition = JSON.parse(savedPosition)
        
        // More accurate bounds validation
        const componentWidth = 288 // w-72 = 288px
        const componentHeight = 200 // Estimated height
        const padding = 8 // Same padding as drag logic
        
        const maxX = window.innerWidth - componentWidth - padding
        const maxY = window.innerHeight - componentHeight - padding
        
        if (
          parsedPosition.x >= padding && 
          parsedPosition.y >= padding && 
          parsedPosition.x <= maxX && 
          parsedPosition.y <= maxY &&
          typeof parsedPosition.x === 'number' &&
          typeof parsedPosition.y === 'number' &&
          !isNaN(parsedPosition.x) &&
          !isNaN(parsedPosition.y)
        ) {
          setPosition(parsedPosition)
        } else {
          // Reset to default if saved position is out of bounds or invalid
          const defaultPosition = { x: 24, y: 24 }
          setPosition(defaultPosition)
          savePosition(defaultPosition)
        }
      } catch (error) {
        console.warn('Failed to parse saved meeting indicator position:', error)
        // Reset to default on parse error
        const defaultPosition = { x: 24, y: 24 }
        setPosition(defaultPosition)
        savePosition(defaultPosition)
      }
    }
  }, [savePosition])

  // Handle window resize to keep position within bounds
  useEffect(() => {
    const handleResize = () => {
      const componentWidth = 288
      const componentHeight = containerRef.current?.offsetHeight || 200
      const padding = 8
      
      const maxX = window.innerWidth - componentWidth - padding
      const maxY = window.innerHeight - componentHeight - padding
      
      // Adjust position if it's now out of bounds
      const newPosition = {
        x: Math.max(padding, Math.min(position.x, maxX)),
        y: Math.max(padding, Math.min(position.y, maxY))
      }
      
      if (newPosition.x !== position.x || newPosition.y !== position.y) {
        setPosition(newPosition)
        savePosition(newPosition)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [position, savePosition])

  // Update time every second for real-time duration
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Socket events are handled by the meeting context
  // No need for separate socket handling here

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Allow dragging from anywhere in the header area
    const target = e.target as HTMLElement
    if (target.closest('button')) return // Don't drag if clicking on buttons
    
    setIsDragging(true)
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // Handle drag move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    
    const newPosition = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    }
    
    // Keep within viewport bounds
    const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 300)
    const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 200)
    
    newPosition.x = Math.max(0, Math.min(newPosition.x, maxX))
    newPosition.y = Math.max(0, Math.min(newPosition.y, maxY))
    
    setPosition(newPosition)
    savePosition(newPosition)
  }, [isDragging, dragOffset, savePosition])

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Animation configuration
  const containerAnimation = {
    initial: { opacity: 0, scale: 0.8, y: -20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.8, y: -20 }
  }

  const containerTransition = {
    duration: 0.3,
    type: "spring" as const,
    stiffness: 300,
    damping: 30
  }

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
    
    // Set a timeout to prevent the button from being stuck in loading state
    const timeoutId = setTimeout(() => {
      console.warn('Meeting end operation timed out')
      setIsEnding(false)
    }, 10000) // 10 second timeout
    
    try {
      // Start the end meeting process
      const endPromise = endCurrentMeeting(currentMeeting?.id)
      
      // Show immediate feedback that the process has started
      const result = await endPromise
      clearTimeout(timeoutId) // Clear timeout if operation completes
      
      if (!result.success) {
        console.error('Failed to end meeting:', result.message)
        alert(`Failed to end meeting: ${result.message}`)
      } 
    } catch (error) {
      clearTimeout(timeoutId) // Clear timeout if operation fails
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
        return 'bg-gradient-to-br from-primary to-secondary'
      case 'phone':
        return 'bg-gradient-to-br from-secondary to-accent'
      case 'in-person':
        return 'bg-gradient-to-br from-accent to-primary'
      default:
        return 'bg-gradient-to-br from-primary to-secondary'
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
    <AnimatePresence mode="wait">
      <motion.div
        ref={containerRef}
        className={cn(
          "fixed z-50 select-none",
          isDragging && "cursor-grabbing",
          className
        )}
        style={{
          left: position.x,
          top: position.y,
        }}
        initial={containerAnimation.initial}
        animate={containerAnimation.animate}
        exit={containerAnimation.exit}
        transition={containerTransition}
      >
      <div className={cn(
        "bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700",
        "backdrop-blur-sm bg-white/95 dark:bg-gray-800/95",
        "min-w-[240px] max-w-[280px]",
        isMinimized ? "h-12" : "h-auto"
      )}>
        {/* Header with brand gradient background */}
        <div 
          className="relative bg-gradient-to-r from-primary to-secondary dark:from-primary dark:to-secondary rounded-t-xl p-2 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-1.5 rounded-lg text-white shadow-md",
                "bg-white/20 backdrop-blur-sm border border-white/30",
                getMeetingTypeColor(currentMeeting.meeting_type || 'video')
              )}>
                {getMeetingTypeIcon(currentMeeting.meeting_type || 'video')}
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">
                  In Meeting
                </h3>
                <p className="text-white/80 text-xs font-medium">
                  {currentMeeting.meeting_type || 'video'} call
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsMinimized(!isMinimized)
                }}
              >
                {isMinimized ? <Video className="h-3 w-3" /> : <X className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          
          {/* Drag handle - more prominent */}
          <div className="absolute top-1 right-8 opacity-40 hover:opacity-80 transition-opacity cursor-grab">
            <Move className="h-3 w-3 text-white" />
          </div>
        </div>

        <motion.div
          animate={{
            height: isMinimized ? 0 : "auto",
            opacity: isMinimized ? 0 : 1
          }}
          transition={{
            duration: 0.3,
            ease: "easeInOut"
          }}
          style={{ overflow: "hidden" }}
        >
          <div className="p-2">
              {/* Meeting Details - Simplified */}
              <div className="space-y-1.5">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                    {currentMeeting.title}
                  </h4>
                </div>

                {/* Meeting Info - Minimal */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <Clock className="h-3 w-3" />
                    <span>{formatMeetingDuration(currentMeeting.start_time)}</span>
                  </div>
                  
                  {/* Status badge to match event indicator height */}
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0"></div>
                    <span>Active</span>
                  </div>
                  
                  {currentMeeting.description && (
                    <div className="text-xs text-gray-600 dark:text-gray-300 truncate">
                      {currentMeeting.description}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={handleEndMeeting}
                    disabled={isEnding || isLoading}
                    variant="destructive"
                    size="sm"
                    className="flex-1 text-xs"
                  >
                    {isEnding ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                        <span>Ending...</span>
                      </>
                    ) : (
                      <>
                        <PhoneOff className="h-3 w-3 mr-1" />
                        <span>End Meeting</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Warning for long meetings */}
                {currentMeeting.start_time && (() => {
                  const start = new Date(currentMeeting.start_time)
                  const now = new Date()
                  const diffHours = (now.getTime() - start.getTime()) / (1000 * 60 * 60)
                  
                  if (diffHours > 2) {
                    return (
                      <div className="mt-2 p-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                        <div className="flex items-center gap-1">
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
            </div>
        </motion.div>
      </div>
      </motion.div>
    </AnimatePresence>
  )
})
