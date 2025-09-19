'use client'

import { AnnouncementsTopBanner } from './announcements-container'
import { useAnnouncementsSocket } from '@/hooks/use-announcements-socket'

export function AnnouncementsLayoutWrapper() {
  // Initialize socket connection for real-time updates
  useAnnouncementsSocket()

  return <AnnouncementsTopBanner />
}
