'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Toilet, ChevronLeft, ChevronRight } from 'lucide-react'
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
  const { isInRestroom, restroomCount, dailyRestroomCount, updateRestroomStatus, isUpdating } = useRestroom()
  const [position, setPosition] = useState(50) // Default to 50% from top
  const [isVisible, setIsVisible] = useState(true) // Default to visible
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(0)
  const [dragStartPosition, setDragStartPosition] = useState(0)
  const [hasDragged, setHasDragged] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
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

  // Load position and visibility from localStorage on mount
  useEffect(() => {
    const savedPosition = localStorage.getItem('restroom-quick-action-position')
    if (savedPosition) {
      setPosition(parseFloat(savedPosition))
    }
    
    const savedVisibility = localStorage.getItem('restroom-quick-action-visible')
    if (savedVisibility !== null) {
      setIsVisible(savedVisibility === 'true')
    }
  }, [])

  // Save position to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('restroom-quick-action-position', position.toString())
  }, [position])

  // Save visibility to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('restroom-quick-action-visible', isVisible.toString())
  }, [isVisible])

  const handleToggleRestroom = async (e?: React.MouseEvent) => {
    // Prevent click if we were dragging or have dragged
    if (isDragging || hasDragged) {
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
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return

    const deltaY = e.clientY - dragStart
    const newPosition = Math.max(5, Math.min(95, dragStartPosition + (deltaY / window.innerHeight) * 100))
    setPosition(newPosition)
    
    // Mark as dragged if moved more than 5 pixels
    if (Math.abs(deltaY) > 5) {
      setHasDragged(true)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    // Reset hasDragged after a short delay to allow click to be processed
    setTimeout(() => {
      setHasDragged(false)
    }, 100)
  }

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
  }, [isDragging, dragStart, dragStartPosition])

  // Don't show restroom button on login page, if not authenticated, during loading, or if agent is in restricted state
  if (pathname === '/login' || pathname === '/' || !currentUser || isLoading || shouldHideRestroom) {
    return null
  }

  return (
    <div 
      ref={containerRef}
      className={`fixed  z-50 cursor-move ${isVisible ? '-right-4' : '-right-4'}`}
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
              ? (isInRestroom 
                  ? "bg-red-500" 
                  : "bg-blue-600")
              : ""
          )} />
          
          {/* Content */}
          <div className="relative h-full w-full flex items-center justify-center">
            {isVisible ? (
              <Toilet className="h-6 w-6 text-white" />
            ) : (
              <ChevronLeft className="h-6 w-6 dark:text-white text-black" />
            )}
          </div>
          
          {/* Click handlers */}
          <button
            onClick={isVisible ? handleToggleRestroom : handleToggleVisibility}
            disabled={isUpdating && isVisible}
            className="absolute inset-0 w-full h-full rounded-full focus:outline-none focus:ring-2 focus:ring-white/50"
            title={isVisible 
              ? (isInRestroom ? `Finish Restroom (${dailyRestroomCount} visits today, ${restroomCount} total)` : `Take Restroom (${dailyRestroomCount} visits today, ${restroomCount} total)`)
              : "Show Restroom Button"
            }
          />
        </div>
        
        {/* Small toggle indicator when visible */}
        {isVisible && (
          <button
            onClick={handleToggleVisibility}
            className={`absolute -left-2 top-1/2 transform -translate-y-1/2 h-6 w-6 rounded-tl-full rounded-bl-full flex items-center justify-center transition-all duration-200 z-10 ${isInRestroom ? 'bg-red-500' : 'bg-blue-600'}` }
            title="Hide Restroom Button"
          >
            <ChevronRight className="h-3 w-3 text-white " />
          </button>
        )}
      </div>
    </div>
  )
}
