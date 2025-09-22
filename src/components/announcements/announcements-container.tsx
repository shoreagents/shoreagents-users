'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AnnouncementBanner } from './announcement-banner'
import { useAnnouncementsContext } from '@/contexts/announcements-context'
import { useAnnouncementsSocket } from '@/hooks/use-announcements-socket'
import { cn } from '@/lib/utils'

interface AnnouncementsContainerProps {
  className?: string
  maxHeight?: string
  showCount?: boolean
}

export function AnnouncementsContainer({ 
  className, 
  maxHeight = 'max-h-96',
  showCount = false 
}: AnnouncementsContainerProps) {
  const { announcements, loading, error, dismissAnnouncement } = useAnnouncementsContext()
  const { isConnected } = useAnnouncementsSocket()

  if (loading) {
    return (
      <div className={cn('p-4', className)}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('p-4', className)}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">
            Failed to load announcements: {error}
          </p>
        </div>
      </div>
    )
  }

  if (announcements.length === 0) {
    return null
  }

  // Sort announcements by priority and sent_at
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 }
    const aPriority = priorityOrder[a.priority] || 0
    const bPriority = priorityOrder[b.priority] || 0
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority
    }
    
    return new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  })

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      {showCount && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">
            Announcements ({announcements.length})
          </h3>
          {!isConnected && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              Offline
            </div>
          )}
        </div>
      )}

      {/* Announcements List */}
      <div className={cn('space-y-3 overflow-y-auto', maxHeight)}>
        {sortedAnnouncements.map((announcement) => (
          <AnnouncementBanner
            key={announcement.announcement_id}
            announcement={announcement}
            onDismiss={dismissAnnouncement}
          />
        ))}
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="text-xs text-gray-500 text-center py-2">
          Real-time updates unavailable
        </div>
      )}
    </div>
  )
}

// Top banner version for app header
export function AnnouncementsTopBanner() {
  const { announcements, dismissAnnouncement } = useAnnouncementsContext()
  const [isScrolled, setIsScrolled] = useState(false)

  // Show all announcements at the top (urgent, high, medium, and low)
  const topAnnouncements = announcements

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      setIsScrolled(scrollY > 50) // Start shrinking after 50px scroll
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (topAnnouncements.length === 0) {
    return null
  }

  return (
    <motion.div 
      className="sticky z-50 px-4"
      animate={{
        top: isScrolled ? "0.5rem" : "0rem" // top-1 when scrolled, top-0 when at top
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
        mass: 0.8
      }}
    >
      <div className="flex">
        {/* Sidebar spacer - matches sidebar width */}
        <div className="w-64 flex-shrink-0" />
        {/* Main content area with Framer Motion animations */}
        <motion.div 
          className="flex-1"
          animate={{
            maxWidth: isScrolled ? "42rem" : "100%", // 42rem = max-w-2xl
            margin: isScrolled ? "0 auto" : "0",
            scale: isScrolled ? 0.95 : 1,
            opacity: isScrolled ? 0.9 : 1
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
            mass: 0.8
          }}
        >
          <motion.div 
            className="space-y-0"
            animate={{
              gap: isScrolled ? "0.25rem" : "0rem"
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30
            }}
          >
            <AnimatePresence mode="popLayout">
              {topAnnouncements.map((announcement, index) => (
                <motion.div
                  key={announcement.announcement_id}
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0, 
                    scale: 1,
                    transition: {
                      delay: isScrolled ? index * 0.1 : 0,
                      type: "spring",
                      stiffness: 400,
                      damping: 25
                    }
                  }}
                  exit={{ 
                    opacity: 0, 
                    y: -20, 
                    scale: 0.9,
                    transition: {
                      delay: (topAnnouncements.length - index - 1) * 0.05
                    }
                  }}
                  layout
                  className="w-full"
                >
                  <AnnouncementBanner
                    announcement={announcement}
                    onDismiss={dismissAnnouncement}
                    className="w-full rounded-full border-0"
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}
