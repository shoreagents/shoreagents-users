'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { X, Info } from 'lucide-react'
import { Announcement } from '@/hooks/use-announcements'
import { cn } from '@/lib/utils'

interface AnnouncementBannerProps {
  announcement: Announcement
  onDismiss: (id: number) => void
  className?: string
}

// Priority-based styles
const priorityStyles = {
  low: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  medium: 'bg-blue-50 border-blue-200 text-blue-800', 
  high: 'bg-amber-50 border-amber-200 text-amber-800',
  urgent: 'bg-red-50 border-red-200 text-red-800'
} 

export function AnnouncementBanner({ announcement, onDismiss, className }: AnnouncementBannerProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isDismissing, setIsDismissing] = useState(false)
  // timeLeft state removed - expiration is now handled by expires_at field

  // Use Info icon for all announcements
  const IconComponent = Info
  const priorityStyle = priorityStyles[announcement.priority] || priorityStyles.medium

  const handleDismiss = useCallback(async () => {
    if (isDismissing) return
    
    setIsDismissing(true)
    setIsVisible(false)
    
    // Add a small delay for animation
    setTimeout(() => {
      onDismiss(announcement.announcement_id)
    }, 300)
  }, [isDismissing, onDismiss, announcement.announcement_id])

  // Auto-close when expires_at is reached
  useEffect(() => {
    if (announcement.expires_at) {
      const expiresAt = new Date(announcement.expires_at).getTime()
      const now = Date.now()
      
      if (now < expiresAt) {
        const timeUntilExpiry = expiresAt - now
        
        const timer = setTimeout(() => {
          handleDismiss()
        }, timeUntilExpiry)
        
        return () => clearTimeout(timer)
      } else {
        // Already expired, dismiss immediately
        handleDismiss()
      }
    }
  }, [announcement.expires_at, handleDismiss])


  if (!isVisible) return null

  return (
    <div
      className={cn(
        'relative overflow-hidden transition-all duration-300 ease-in-out',
        'border-t-4 px-4 py-3',
        priorityStyle,
        isDismissing && 'opacity-0 scale-95',
        className
      )}
    >
      {/* Content */}
      <div className="flex items-center justify-center gap-3 relative">
        {/* Icon */}
        <div className="flex-shrink-0">
          <IconComponent 
            className="h-5 w-5"
          />
        </div>

        {/* Main Content - Centered */}
        <div className="flex-1 text-center">
          <h3 className="text-sm font-semibold leading-5">
            {announcement.title}
          </h3>
          <p className="mt-1 text-sm leading-5">
            {announcement.message}
          </p>
        </div>

        {/* Dismiss Button - Positioned absolutely on the right */}
        {announcement.allow_dismiss && (
          <button
            onClick={handleDismiss}
            disabled={isDismissing}
            className={cn(
              'absolute right-0 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors',
              'hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-black/20',
              'disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 hover:text-gray-800'
            )}
            aria-label="Dismiss announcement"
            title="Dismiss announcement"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Auto-close Timer removed - expiration handled by expires_at field */}
    </div>
  )
}
