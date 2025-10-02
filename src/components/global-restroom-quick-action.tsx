'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Toilet, ChevronLeft, ChevronRight, Droplets, Clock12, X } from 'lucide-react'
import { useRestroom } from '@/contexts/restroom-context'
import { cn } from '@/lib/utils'
import { getCurrentUser } from '@/lib/ticket-utils'
import { usePathname } from 'next/navigation'
import { useLoading } from '@/contexts/loading-context'
import { useEventsContext } from '@/contexts/events-context'
import { useHealth } from '@/contexts/health-context'
import { useMeeting } from '@/contexts/meeting-context'
import { useBreak } from '@/contexts/break-context'

export function GlobalRestroomQuickAction() {
  const { isInRestroom, restroomCount, dailyRestroomCount, updateRestroomStatus, isUpdating, isShiftEnded } = useRestroom()
  const [position, setPosition] = useState(50) // Default to 50% from top
  const [isVisible, setIsVisible] = useState(true) // Default to visible
  const [isOnRight, setIsOnRight] = useState(true) // Default to right side
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(0)
  const [dragStartPosition, setDragStartPosition] = useState(0)
  const [hasDragged, setHasDragged] = useState(false)
  const [mouseDownTime, setMouseDownTime] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStateRef = useRef({ isDragging: false, hasDragged: false })
  const pathname = usePathname()
  const { isLoading } = useLoading()

  // Get agent state contexts
  const { isInEvent } = useEventsContext()
  const { isGoingToClinic, isInClinic } = useHealth()
  const { isInMeeting } = useMeeting()
  const { isBreakActive } = useBreak()

  // Check if user is authenticated and logged in
  const currentUser = getCurrentUser()

  // Check if restroom should be hidden/disabled
  const shouldHideRestroom = isInEvent || isGoingToClinic || isInClinic || isInMeeting || isBreakActive 

  // Load position, visibility, and side from localStorage on mount
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    const savedPosition = localStorage.getItem('restroom-quick-action-position')
    if (savedPosition) {
      setPosition(parseFloat(savedPosition))
    }
    
    const savedVisibility = localStorage.getItem('restroom-quick-action-visible')
    if (savedVisibility !== null) {
      setIsVisible(savedVisibility === 'true')
    }
    
    const savedSide = localStorage.getItem('restroom-quick-action-side')
    if (savedSide !== null) {
      setIsOnRight(savedSide === 'right')
    }
  }, [])

  // Save position to localStorage when it changes
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    localStorage.setItem('restroom-quick-action-position', position.toString())
  }, [position])

  // Save visibility to localStorage when it changes
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    localStorage.setItem('restroom-quick-action-visible', isVisible.toString())
  }, [isVisible])

  // Save side to localStorage when it changes
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return
    
    localStorage.setItem('restroom-quick-action-side', isOnRight ? 'right' : 'left')
  }, [isOnRight])

  const handleToggleRestroom = async (e?: React.MouseEvent) => {
    // Prevent click if we were actively dragging, have dragged, or if it was a very quick click (likely accidental)
    if (dragStateRef.current.isDragging || dragStateRef.current.hasDragged || (mouseDownTime > 0 && Date.now() - mouseDownTime < 50)) {
      e?.preventDefault()
      e?.stopPropagation()
      return
    }
    await updateRestroomStatus(!isInRestroom)
  }

  const handleToggleVisibility = () => {
    setIsVisible(!isVisible)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start dragging if clicking on the button itself, not on a child element
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('button')) {
      setIsDragging(true)
      setHasDragged(false)
      setDragStart(e.clientY)
      setDragStartPosition(position)
      setMouseDownTime(Date.now())
      
      // Update ref state
      dragStateRef.current.isDragging = true
      dragStateRef.current.hasDragged = false
      
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const deltaY = e.clientY - dragStart
    const deltaX = e.clientX - (isOnRight ? window.innerWidth - 56 : 56) // 56px is roughly the button width
    
    const newPosition = Math.max(5, Math.min(95, dragStartPosition + (deltaY / window.innerHeight) * 100))
    setPosition(newPosition)
    
    // Check if dragged to the other side (threshold of 100px from center)
    const centerX = window.innerWidth / 2
    const shouldBeOnRight = e.clientX > centerX
    if (shouldBeOnRight !== isOnRight) {
      setIsOnRight(shouldBeOnRight)
    }
    
    // Mark as dragged only if moved more than 10 pixels (increased threshold to reduce false positives)
    if (Math.abs(deltaY) > 10 || Math.abs(deltaX) > 10) {
      setHasDragged(true)
      dragStateRef.current.hasDragged = true
    }
  }, [isDragging, dragStart, dragStartPosition, isOnRight])

  const handleMouseUp = useCallback(() => {
    const wasDragging = isDragging
    const hadDragged = hasDragged
    
    setIsDragging(false)
    setMouseDownTime(0)
    
    // Update ref state
    dragStateRef.current.isDragging = false
    
    // If there was any dragging, keep hasDragged true for a longer period to prevent click
    if (hadDragged) {
      // Keep hasDragged true for longer to prevent any click after drag
      setTimeout(() => {
        setHasDragged(false)
        dragStateRef.current.hasDragged = false
      }, 200) // Increased delay to prevent click after drag
    } else {
      // Reset immediately if no dragging occurred
      setHasDragged(false)
      dragStateRef.current.hasDragged = false
    }
  }, [isDragging, hasDragged])

  // Add event listeners for mouse move and up
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = 'none' // Prevent text selection while dragging
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
    }
  }, [isDragging, dragStart, dragStartPosition, handleMouseMove, handleMouseUp])

  // Don't show restroom button on login page, if not authenticated, during loading, or if agent is in restricted state
  if (pathname === '/login' || pathname === '/' || !currentUser || isLoading || shouldHideRestroom) {
    return null
  }

  return (
    <div 
      ref={containerRef}
      className={`fixed z-50 cursor-move ${isOnRight ? '-right-4' : '-left-4'}`}
      style={{ top: `${position}%`, transform: 'translateY(-50%)' }}
      onMouseDown={handleMouseDown}
      data-restroom-quick-action
    >
      {/* Unified Button Container */}
      <div className="relative">
        {/* Main Button - Always visible but changes appearance */}
        <div className={cn(
          "relative rounded-full  transition-all duration-300  select-none overflow-hidden",
          isDragging && "scale-105",
          isVisible 
            ? "h-14 w-14" 
            : "h-12 w-12"
        )}>
          <div className={cn(
            "absolute inset-0 rounded-full transition-all duration-300",
            isVisible 
              ? (isShiftEnded
                  ? "bg-gray-500"
                  : isInRestroom 
                    ? "bg-red-500" 
                    : "bg-blue-600")
              : ""
          )} />
          
          {/* Content */}
          <div className="relative h-full w-full flex items-center justify-center">
            {isVisible ? (
              isShiftEnded ? (
                <X className="h-6 w-6 text-white mr-1" />
              ) : isInRestroom ? (
                <Clock12 className="h-6 w-6 text-white animate-spin mr-1" />
              ) : (
                <Toilet className="h-6 w-6 text-white mr-1" />
              )
            ) : (
              <div className={cn(
                "relative",
                isInRestroom && "animate-bounceLeft"
              )}>
                {isOnRight ? (
                  <ChevronLeft className="h-6 w-6 dark:text-white text-black relative" />
                ) : (
                  <ChevronRight className="h-6 w-6 dark:text-white text-black relative" />
                )}
                {/* Restroom status indicator */}
                {isInRestroom && (
                  <div className="absolute top-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse" />
                )}
              </div>
            )}
          </div>
          
          {/* Click handlers */}
          <button
            onClick={isVisible && !isShiftEnded ? handleToggleRestroom : handleToggleVisibility}
            disabled={isUpdating && isVisible}
            className="absolute inset-0 w-full h-full rounded-full focus:outline-none focus:ring-2 focus:ring-white/50"
            title={isVisible 
              ? (isShiftEnded 
                  ? "Restroom disabled - shift has ended" 
                  : isInRestroom 
                    ? `Finish Restroom (${dailyRestroomCount} visits today, ${restroomCount} total)` 
                    : `Take Restroom (${dailyRestroomCount} visits today, ${restroomCount} total)`)
              : (isInRestroom ? `Currently in Restroom - Click to finish (${dailyRestroomCount} visits today, ${restroomCount} total)` : "Show Restroom Button")
            }
          />
        </div>
        
        {/* Small toggle indicator when visible - Triangular shape */}
        {isVisible && (
          <button
            onClick={handleToggleVisibility}
            className={`absolute ${isOnRight ? '-left-2' : '-right-2'} top-1/2 transform -translate-y-1/2 w-0 h-0 flex items-center justify-center transition-all duration-200 z-10`}
            title="Hide Restroom Button"
            style={{
              borderTop: '12px solid transparent',
              borderBottom: '12px solid transparent',
              [isOnRight ? 'borderRight' : 'borderLeft']: `12px solid ${isShiftEnded ? '#6b7280' : isInRestroom ? '#ef4444' : '#2563eb'}`,
            }}
          >
            <div className={`absolute ${isOnRight ? '-right-3' : '-left-3'} top-1/2 transform -translate-y-1/2`}>
              {isOnRight ? (
                <ChevronLeft className="h-3 w-3 text-white" />
              ) : (
                <ChevronRight className="h-3 w-3 text-white" />
              )}
            </div>
          </button>
        )}
      </div>
    </div>
  )
}
