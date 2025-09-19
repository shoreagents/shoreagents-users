'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useAnnouncements, Announcement, AnnouncementStats } from '@/hooks/use-announcements'

interface AnnouncementsContextType {
  announcements: Announcement[]
  allAnnouncements: Announcement[]
  loading: boolean
  error: string | null
  stats: AnnouncementStats | null
  fetchAnnouncements: (includeDismissed?: boolean) => Promise<void>
  dismissAnnouncement: (announcementId: number, reason?: string) => Promise<void>
  getAnnouncementsByPriority: (priority: string) => Announcement[]
  refetch: () => Promise<void>
}

const AnnouncementsContext = createContext<AnnouncementsContextType | undefined>(undefined)

export function AnnouncementsProvider({ children }: { children: ReactNode }) {
  const announcementsData = useAnnouncements()

  return (
    <AnnouncementsContext.Provider value={announcementsData}>
      {children}
    </AnnouncementsContext.Provider>
  )
}

export function useAnnouncementsContext() {
  const context = useContext(AnnouncementsContext)
  if (context === undefined) {
    throw new Error('useAnnouncementsContext must be used within an AnnouncementsProvider')
  }
  return context
}
