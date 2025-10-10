"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useEventsContext } from './events-context'
import { useSocket } from './socket-context'
import { getCurrentUser } from '@/lib/ticket-utils'

interface BreakContextType {
  isBreakActive: boolean
  activeBreakId: string | null
  setBreakActive: (active: boolean, breakId?: string) => void
  setBreakActiveAfterEventLeave: (active: boolean, breakId?: string) => void
  isInitialized: boolean
  canStartBreak: boolean
  breakBlockedReason: string | null
}

const BreakContext = createContext<BreakContextType | undefined>(undefined)

export function BreakProvider({ children }: { children: React.ReactNode }) {
  const [isBreakActive, setIsBreakActive] = useState(false)
  const [activeBreakId, setActiveBreakId] = useState<string | null>(null)
  const isInitialized = true
  
  // Check if user is in an event
  const { isInEvent, currentEvent } = useEventsContext()
  
  // Socket context for real-time updates
  const { socket, isConnected } = useSocket()

  const setBreakActive = useCallback((active: boolean, breakId?: string) => {
    // Prevent starting a break if user is in an event
    if (active && isInEvent) {
      throw new Error(`Cannot start break while in event: ${currentEvent?.title || 'Unknown Event'}. Please leave the event first.`)
    }
    
    setIsBreakActive(active)
    setActiveBreakId(active ? breakId || null : null)
  }, [isInEvent, currentEvent])

  const setBreakActiveAfterEventLeave = useCallback((active: boolean, breakId?: string) => {
    // This function bypasses the event check for use after leaving an event
    setIsBreakActive(active)
    setActiveBreakId(active ? breakId || null : null)
  }, [])

  // Emit break status updates when status changes
  useEffect(() => {
    if (!socket || !isConnected) return

    const currentUser = getCurrentUser()
    const email = currentUser?.email
    
    if (!email) return

    // Emit current break status
    socket.emit('updateBreakStatus', isBreakActive, activeBreakId)
  }, [socket, isConnected, isBreakActive, activeBreakId])

  // Send break state to Electron main process for activity tracking
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.breakMonitoring?.updateBreakState) {
      window.electronAPI.breakMonitoring.updateBreakState({
        isBreakActive,
        activeBreakId
      }).catch((error: any) => {
        console.error('Failed to update break state in main process:', error)
      })
    }
  }, [isBreakActive, activeBreakId])

  // Determine if break can be started
  const canStartBreak = !isInEvent
  const breakBlockedReason = isInEvent ? `Cannot start break while in event: ${currentEvent?.title || 'Unknown Event'}` : null

  const value = {
    isBreakActive,
    activeBreakId,
    setBreakActive,
    setBreakActiveAfterEventLeave,
    isInitialized,
    canStartBreak,
    breakBlockedReason
  }

  return (
    <BreakContext.Provider value={value}>
      {children}
    </BreakContext.Provider>
  )
}

export function useBreak() {
  const context = useContext(BreakContext)
  if (context === undefined) {
    throw new Error('useBreak must be used within a BreakProvider')
  }
  return context
} 